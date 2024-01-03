import { Scanner, Scope, Token, TokenType } from "./scanner"
import * as nodes from "./nodes"
import { IssueType, Level, Marker, ParseError } from "./errors"
import { colorFunctions, colorKeywords, colorNames } from "./color"
import * as ASCII from "./ascii"

export interface Mark {
	prev?: Token
	current: Token
	pos: number
}

export class Parser {
	protected scanner: Scanner
	protected token: Token
	protected prevToken?: Token
	protected lastErrorToken?: Token

	constructor() {
		this.scanner = new Scanner()
	}

	public set scope(s: Scope) {
		this.scanner.scope = s
	}

	public parse<Node extends nodes.Node, U extends Node | undefined>(
		text: string,
		parseFunc: () => U,
		stringProvider?: nodes.StringProvider,
	): U {
		this.scanner.setSource(text)
		this.token = this.scanner.next().value
		const node: U = parseFunc.bind(this)()
		if (node) {
			if (stringProvider) {
				node.stringProvider = stringProvider
			} else {
				node.stringProvider = (start: number, end: number) => text.slice(start, end)
			}
		}
		return node
	}

	public peekRegExp(type: TokenType, regEx: RegExp): boolean {
		if (type !== this.token.type) {
			return false
		}
		const raw = this.getText()
		return regEx.test(raw)
	}

	public peekStr(type: TokenType, value: string): boolean {
		if (type !== this.token.type) {
			return false
		}
		return value === this.getText()
	}

	public hasWhitespace(): boolean {
		return !!this.prevToken && this.prevToken.end !== this.token.start
	}

	public consumeToken(): void {
		this.prevToken = this.token
		this.token = this.scanner.next().value
	}

	public mark(): Mark {
		return {
			prev: this.prevToken,
			current: this.token,
			pos: this.scanner.pos(),
		}
	}

	public restoreAtMark(mark: Mark) {
		this.prevToken = mark.prev
		this.token = mark.current
		this.scanner.goBackTo(mark.pos)
	}

	public peek(type: TokenType): boolean {
		return type === this.token.type
	}

	public type() {
		return this.token.type
	}

	public peekDelim(text: string): boolean {
		if (!this.peek(TokenType.Delim)) {
			return false
		}
		return text === this.scanner.source.slice(this.token.start, this.token.end)
	}

	public acceptDelim(text: string): boolean {
		if (!this.peekDelim(text)) {
			return false
		}
		return this.accept(TokenType.Delim)
	}

	public accept(type: TokenType): boolean {
		if (this.peek(type)) {
			this.consumeToken()
			return true
		}
		return false
	}

	public create<T>(ctor: nodes.NodeConstructor<T>): T {
		return new ctor(this.token.start, this.token.end)
	}

	public createNode(t: nodes.NodeType) {
		return new nodes.Node(this.token.start, this.token.end, t)
	}

	public resync(resyncTokens: TokenType[] | undefined, resyncStopTokens: TokenType[] | undefined): boolean {
		while (true) {
			if (resyncTokens && resyncTokens.indexOf(this.token.type) !== -1) {
				this.consumeToken()
				return true
			} else if (resyncStopTokens && resyncStopTokens.indexOf(this.token.type) !== -1) {
				return true
			} else {
				if (this.token.type === TokenType.EOF) {
					return false
				}
				this.token = this.scanner.next().value
			}
		}
	}

	public finish<T extends nodes.Node>(
		node: T,
		error?: IssueType,
		resyncTokens?: TokenType[],
		resyncStopTokens?: TokenType[],
	): T {
		// parseNumeric misuses error for boolean flagging (however the real error mustn't be a false)
		// + nodelist offsets mustn't be modified, because there is a offset hack in rulesets for smartselection
		if (!(node instanceof nodes.Nodelist)) {
			if (error) {
				this.markError(node, error, resyncTokens, resyncStopTokens)
			}
			// set the node end position
			if (this.prevToken) {
				// length with more elements belonging together
				node.end = this.prevToken.end > node.start ? this.prevToken.end : node.start // offset is taken from current token, end from previous: Use 0 for empty nodes
			}
		}
		return node
	}

	public markError<T extends nodes.Node>(
		node: T,
		error: IssueType,
		resyncTokens?: TokenType[],
		resyncStopTokens?: TokenType[],
	): void {
		if (this.token !== this.lastErrorToken) {
			// do not report twice on the same token
			node.addIssue(new Marker(node, error, Level.Error, undefined, this.token.start, this.token.end))
			this.lastErrorToken = this.token
		}
		if (resyncTokens || resyncStopTokens) {
			this.resync(resyncTokens, resyncStopTokens)
		}
	}

	///

	public parseTwProgram(): nodes.TwProgram | undefined {
		const node = this.create(nodes.TwProgram)
		while (node.addChild(this.parseTwExpr())) {}
		return this.finish(node)
	}

	public parseTwExpr(): nodes.TwExpression | undefined {
		return this.parseTwGroupTerm() || this.parseTwDeclTerm() || this.parseTwRawTerm()
	}

	public parseTwIdentifier(): nodes.TwIdentifier | undefined {
		if (!this.peek(TokenType.Token)) {
			return
		}

		const pos = this.mark()

		const node = this.create(nodes.TwIdentifier)
		node.addChild(this.create(nodes.TwLiteral))
		this.consumeToken()

		while (true) {
			if (!this.hasWhitespace()) {
				if (this.peek(TokenType.Token)) {
					node.addChild(this.create(nodes.TwLiteral))
					this.consumeToken()
					continue
				}
				if (this.peek(TokenType.Hyphen)) {
					node.addChild(this.create(nodes.Hyphen))
					this.consumeToken()
					continue
				}
				if (this.peek(TokenType.Slash)) {
					node.addChild(this.create(nodes.TwSlash))
					this.consumeToken()
					continue
				}
			}
			break
		}

		if (!node.hasChildren()) {
			this.restoreAtMark(pos)
			return
		}

		return this.finish(node)
	}

	private parseTwGroupTerm(): nodes.TwGroup | nodes.TwSpan | undefined {
		const pos = this.mark()
		let important = this.accept(TokenType.Bang)
		if (important && this.hasWhitespace()) {
			this.restoreAtMark(pos)
			return
		}

		const group = this.create(nodes.TwGroup)
		if (!this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos)
			return
		}

		while (group.addChild(this.parseTwExpr())) {}

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(group, ParseError.RightParenthesisExpected)
		}
		this.finish(group)

		if (!this.hasWhitespace() && this.acceptDelim(":")) {
			const span = new nodes.TwSpan(group.start, group.end)
			span.setVariant(group)
			if (this.hasWhitespace()) {
				return this.finish(span)
			}
			span.setExpr(this.parseTwExpr())
			return this.finish(span)
		}

		group.important = important || (!this.hasWhitespace() && this.accept(TokenType.Bang))
		return this.finish(group)
	}

	// []:, [], {}:
	private parseTwRawTerm(): nodes.TwRaw | nodes.TwSpan | undefined {
		const pos = this.mark()
		let important = this.accept(TokenType.Bang)
		if (important && this.hasWhitespace()) {
			this.restoreAtMark(pos)
			return
		}

		const raw = this.create(nodes.TwRaw)
		this.scanner.scope = Scope.CssValue
		let bracket: TokenType
		if (this.accept(TokenType.BracketL)) {
			bracket = TokenType.BracketL
		} else if (this.accept(TokenType.CurlyL)) {
			bracket = TokenType.CurlyL
		} else {
			this.restoreAtMark(pos)
			this.scanner.scope = Scope.Tw
			return
		}

		raw.addChild(this.parseCssDecl())
		this.scanner.scope = Scope.Tw

		if (bracket === TokenType.BracketL && this.accept(TokenType.BracketR)) {
		} else if (bracket === TokenType.CurlyL && this.accept(TokenType.CurlyR)) {
		} else {
			return this.finish(raw, ParseError.RightBracketExpected)
		}
		this.finish(raw)

		if (!this.hasWhitespace() && this.acceptDelim(":")) {
			const span = new nodes.TwSpan(raw.start, raw.end)
			span.setVariant(raw)
			if (this.hasWhitespace()) {
				return this.finish(span)
			}
			span.setExpr(this.parseTwExpr())
			return this.finish(span)
		}

		raw.important = important || (!this.hasWhitespace() && this.accept(TokenType.Bang))
		return this.finish(raw)
	}

	// xxx/yyy/zzz
	// [!]<ident>[!]
	// <ident>[][/<modifier>]
	// <ident>[/<modifier>]
	private parseTwDeclTerm(): nodes.TwDecl | nodes.TwSpan | undefined {
		const pos = this.mark()

		let important = this.accept(TokenType.Bang)
		if (important && this.hasWhitespace()) {
			this.restoreAtMark(pos)
			return
		}

		const decl = this.create(nodes.TwDecl)

		if (this.accept(TokenType.Hyphen)) {
			decl.minus = true
		}

		const key = this.parseTwIdentifier()
		if (!decl.setIdentifier(key)) {
			this.restoreAtMark(pos)
			return
		}

		let skip = false
		if (!this.hasWhitespace()) {
			switch (key.lastChild?.type) {
				case nodes.NodeType.TwLiteral:
					skip = true
					break
				case nodes.NodeType.Hyphen:
					if (this.peek(TokenType.BracketL)) {
						this.scanner.scope = Scope.CssValue
						this.consumeToken()
						decl.setValue(this.parseCssDecl())
						this.scanner.scope = Scope.Tw
						if (!this.accept(TokenType.BracketR)) {
							return this.finish(decl, ParseError.RightBracketExpected)
						}
						this.finish(decl)
					}
					break
				case nodes.NodeType.TwSlash:
					if (this.peek(TokenType.BracketL)) {
						this.scanner.scope = Scope.TwModifier
						this.consumeToken()
						decl.setModifier(this.parseTwModifier(true))
						this.scanner.scope = Scope.Tw
						if (!this.accept(TokenType.BracketR)) {
							return this.finish(decl, ParseError.RightBracketExpected)
						}
						this.finish(decl)
					}
					break
			}

			// vvv-[]/[]
			if (!skip && !this.hasWhitespace() && this.accept(TokenType.Slash)) {
				if (this.peek(TokenType.BracketL)) {
					this.scanner.scope = Scope.TwModifier
					this.consumeToken()
					decl.setModifier(this.parseTwModifier(true))
					this.scanner.scope = Scope.Tw
					if (!this.accept(TokenType.BracketR)) {
						return this.finish(decl, ParseError.RightBracketExpected)
					}
					this.finish(decl)
				}
			}
		}

		if (!this.hasWhitespace() && this.acceptDelim(":")) {
			const span = new nodes.TwSpan(decl.start, decl.end)
			span.setVariant(decl)
			if (this.hasWhitespace()) {
				return this.finish(span)
			}
			span.setExpr(this.parseTwExpr())
			return this.finish(span)
		}

		decl.important = important || (!this.hasWhitespace() && this.accept(TokenType.Bang))
		return this.finish(decl)
	}

	public parseTwModifier(wrapped = false): nodes.TwModifier | undefined {
		const node = this.create(nodes.TwModifier)
		if (this.peek(TokenType.Modifier)) {
			node.wrapped = wrapped
			this.consumeToken()
		}
		return this.finish(node)
	}

	public parseCssDecl(): nodes.CssDecl | undefined {
		const pos = this.mark()
		const node = this.create(nodes.CssDecl)
		const tag = this.parseIdentifier()
		if (tag) {
			if (this.acceptDelim(":")) {
				node.setId(tag)
			} else {
				this.restoreAtMark(pos)
			}
		}
		node.setValue(this.parseCssValue())
		return this.finish(node)
	}

	public parseCssValue(): nodes.CssValue | undefined {
		const node = this.create(nodes.CssValue)
		node.addChild(this.parseCssExpression())
		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this.parseCssExpression())) {
				break
			}
		}
		if (node.hasChildren()) {
			return this.finish(node)
		}
	}

	private parseCssExpression() {
		const node = this.create(nodes.CssExpression)
		while (node.addChild(this.parseCssTermExpr())) {}
		if (node.hasChildren()) {
			return this.finish(node)
		}
	}

	public parseCssTermExpr() {
		return (
			this.parseUnicodeRange() ||
			this.parseCssFunction() ||
			this.parseNamedColor() ||
			this.parseKeywordColor() ||
			this.parseIdentifier() ||
			this.parseStringLiteral() ||
			this.parseNumeric() ||
			this.parseHexColor() ||
			this.parseBrackets() ||
			this.parseAny()
		)
	}

	public parseUnicodeRange(): nodes.UnicodeRange | undefined {
		if (!this.peek(TokenType.Identifier)) {
			return
		}
		if (this.getText().toLowerCase() !== "u") {
			return
		}
		const node = this.create(nodes.UnicodeRange)
		if (!this.acceptUnicodeRange()) {
			return
		}
		return this.finish(node)
	}

	public acceptUnicodeRange(): boolean {
		const token = this.scanner.tryScanUnicode() // +10FFFF
		if (token) {
			this.prevToken = token
			this.token = this.scanner.next().value
			return true
		}
		return false
	}

	public parseCssFunction(): nodes.Function | undefined {
		const pos = this.mark()
		let node = this.create(nodes.Function)

		if (!node.setIdentifier(this.parseIdentifier())) {
			this.restoreAtMark(pos)
			return
		}

		let fnName = ""
		if (this.prevToken) {
			fnName = this.getText(this.prevToken)
		}
		fnName = fnName.toLowerCase()

		if (this.hasWhitespace() || !this.peek(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos)
			return
		}

		if (fnName === "theme") {
			// colors.red.100
			// colors . space . 1/1
			// colors.space[1.5]
			// colors.foo-5 / 10 / 10% / 20%
			// <value>/<modifier>
			// <value> := <id>[.<id>|<index>]
			this.scanner.scope = Scope.ThemeLiteral
			this.consumeToken()
			if (this.peek(TokenType.Token)) {
				node.addChild(this.create(nodes.TwThemeIdentifier))
				this.consumeToken()
			}
			while (true) {
				if (this.peek(TokenType.BracketR) || this.peek(TokenType.ParenthesisR) || this.peek(TokenType.EOF)) {
					break
				}
				if (node.addChild(this._parseThemeAccessIndentifer() || this._parseThemePropertyIdentifer())) {
					continue
				}
				this.consumeToken()
			}
			this.scanner.scope = Scope.CssValue
		} else if (/^url(-prefix)?$/.test(fnName)) {
			node.type = nodes.NodeType.URILiteral
			this.scanner.scope = Scope.URILiteral
			this.consumeToken()
			node.addChild(this._parseURLArgument())
			this.scanner.scope = Scope.CssValue
		} else if (colorFunctions.has(fnName)) {
			node = nodes.ColorFunction.from(node)
			this.consumeToken()
			node.setArguments(this.parseCssValue())
		} else {
			this.consumeToken()
			node.setArguments(this.parseCssValue())
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected)
		}
		return this.finish(node)
	}

	public parseBrackets(): nodes.Brackets | undefined {
		const node = this.create(nodes.Brackets)

		if (this.accept(TokenType.ParenthesisL)) {
			node.addChild(this.parseCssDecl())
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected)
			}
			return this.finish(node)
		} else if (this.accept(TokenType.BracketL)) {
			node.brackets = [ASCII.leftBracket, ASCII.rightBracket]
			const x = node.addChild(this.parseCssDecl())
			if (!this.accept(TokenType.BracketR)) {
				return this.finish(node, ParseError.RightBracketExpected)
			}
			return this.finish(node)
		} else if (this.accept(TokenType.CurlyL)) {
			node.brackets = [ASCII.leftCurly, ASCII.rightCurly]
			node.addChild(this.parseCssDecl())
			if (!this.accept(TokenType.CurlyR)) {
				return this.finish(node, ParseError.RightCurlyExpected)
			}
			return this.finish(node)
		}

		return undefined
	}

	public parseNamedColor(): nodes.NamedColorValue | undefined {
		if (!this.peek(TokenType.Identifier)) {
			return
		}

		const word = this.token.getText(this.scanner.source)

		if (colorNames[word]) {
			const node = this.create(nodes.NamedColorValue)
			this.consumeToken()
			return this.finish(node)
		}
	}

	public parseKeywordColor(): nodes.KeywordColorValue | undefined {
		if (!this.peek(TokenType.Identifier)) {
			return
		}

		const word = this.token.getText(this.scanner.source)

		if (colorKeywords.indexOf(word) !== -1) {
			const node = this.create(nodes.KeywordColorValue)
			this.consumeToken()
			return this.finish(node)
		}
	}

	public parseIdentifier(): nodes.Identifier | undefined {
		if (!this.peek(TokenType.Identifier)) {
			return
		}

		const word = this.token.getText(this.scanner.source)

		const node = this.create(nodes.Identifier)
		node.isCustomProperty = word.startsWith("--")
		this.consumeToken()
		return this.finish(node)
	}

	public parseStringLiteral(): nodes.Node | undefined {
		if (!this.peek(TokenType.String) && !this.peek(TokenType.BadString)) {
			return
		}

		const node = this.create(nodes.StringLiteral)
		this.consumeToken()
		return this.finish(node)
	}

	public parseHexColor(): nodes.Node | undefined {
		if (this.peekRegExp(TokenType.Hash, /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/g)) {
			const node = this.create(nodes.HexColorValue)
			this.consumeToken()
			return this.finish(node)
		}
	}

	public parseNumeric(): nodes.NumericValue | undefined {
		// TODO: type
		let tokenType: TokenType
		if (this.peek(TokenType.Percentage)) {
			tokenType = TokenType.Percentage
		} else if (this.peek(TokenType.Dimension)) {
			tokenType = TokenType.Dimension
		} else if (this.peek(TokenType.Num)) {
			tokenType = TokenType.Num
		} else {
			return
		}

		const node = this.create(nodes.NumericValue)
		this.consumeToken()
		return this.finish(node)
	}

	public parseAny() {
		switch (this.token.type) {
			case TokenType.Hash: {
				const node = this.create(nodes.Identifier)
				this.consumeToken()
				return this.finish(node)
			}
			case TokenType.Slash:
			case TokenType.Bang:
			case TokenType.Delim: {
				const node = this.create(nodes.Delim)
				this.consumeToken()
				return this.finish(node)
			}
			// case TokenType.BracketL:
			// case TokenType.BracketR:
			// case TokenType.ParenthesisL:
			// case TokenType.ParenthesisR:
			// case TokenType.CurlyL:
			// case TokenType.CurlyR:
			// case TokenType.Comma:
			// ...
		}
	}

	private _parseThemeAccessIndentifer() {
		if (!this.peek(TokenType.BracketL)) {
			return
		}

		const node = this.create(nodes.TwThemeIdentifier)
		this.scanner.scope = Scope.Raw
		this.consumeToken()

		while (true) {
			if (this.peek(TokenType.Token)) {
				node.addChild(this.create(nodes.TwLiteral))
				this.consumeToken()
				continue
			}
			if (!this.peek(TokenType.Slash)) {
				break
			}
			node.addChild(this.create(nodes.Delim))
			this.consumeToken()
		}

		this.scanner.scope = Scope.ThemeLiteral

		if (!this.accept(TokenType.BracketR)) {
			return this.finish(node, ParseError.RightBracketExpected)
		}

		return this.finish(node)
	}

	private _parseThemePropertyIdentifer() {
		if (!this.acceptDelim(".")) {
			return
		}

		const node = this.create(nodes.TwThemeIdentifier)
		node.addChild(this.create(nodes.TwLiteral))
		this.consumeToken()

		while (true) {
			if (this.peek(TokenType.Token)) {
				node.addChild(this.create(nodes.TwLiteral))
				this.consumeToken()
				continue
			}
			if (!this.peekDelim(".")) {
				break
			}
			node.addChild(this.create(nodes.Delim))
			this.consumeToken()
		}

		return node
	}

	private getText(token = this.token) {
		return this.scanner.source.slice(token.start, token.end)
	}

	private devNode(node?: nodes.Node, prefix = "") {
		if (!node) {
			return "[null]"
		}
		node.stringProvider = (start, end) => this.scanner.source.slice(start, end)
		return `${prefix} [${node.start}, ${node.end}] ${node.typeText} "${node.text}"`
	}

	private _parseURLArgument(): nodes.Node | undefined {
		const node = this.create(nodes.Node)
		if (this.accept(TokenType.String) || this.accept(TokenType.BadString) || this.acceptUnquotedString()) {
			return this.finish(node)
		}
	}

	private acceptUnquotedString(): boolean {
		const pos = this.scanner.pos()
		this.scanner.goBackTo(this.token.start)
		const unquoted = this.scanner.scanUnquotedString()
		if (unquoted) {
			this.token = unquoted
			this.consumeToken()
			return true
		}
		this.scanner.goBackTo(pos)
		return false
	}

	public devToken() {
		return `${this.token.typeText} [${this.token.start}, ${this.token.end}] "${this.getText()}"`
	}

	public devPrevToken() {
		if (!this.prevToken) {
			return "null prevToken"
		}
		return `${this.prevToken.typeText} [${this.prevToken.start}, ${this.prevToken.end}] "${this.getText(
			this.prevToken,
		)}"`
	}
}
