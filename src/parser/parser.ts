import { Scanner, ScannerScope, Token, TokenType } from "./scanner"
import * as nodes from "./nodes"
import { IssueType, Level, Marker, ParseError } from "./errors"
import { colorKeywords, colorNames } from "./color"
import * as ASCII from "./ascii"

const colorFunctions = new Set(["rgb", "rgba", "hsl", "hsla", "hwb", "lch", "lab", "oklab", "oklch", "color"])

interface Mark {
	prev?: Token
	current: Token
	pos: number
}

export class Parser {
	protected scanner: Scanner
	protected token: Token
	protected prevToken?: Token
	protected lastErrorToken?: Token

	constructor(scnr = new Scanner()) {
		this.scanner = scnr
	}

	public peekRegExp(type: TokenType, regEx: RegExp): boolean {
		if (type !== this.token.type) {
			return false
		}
		const raw = this.token.getText(this.scanner.source)
		return regEx.test(raw)
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

	/** Test current token and consume next. */
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

	public parse<Node extends nodes.Node, U extends Node | undefined>(
		input: string,
		parseFunc: () => U,
		stringProvider?: nodes.StringProvider,
	): U {
		this.scanner.setSource(input)
		this.token = this.scanner.next().value
		const node: U = parseFunc.bind(this)()
		if (node) {
			if (stringProvider) {
				node.stringProvider = stringProvider
			} else {
				node.stringProvider = (start: number, end: number) => input.slice(start, end)
			}
		}
		return node
	}

	///

	public parseTwProgram(): nodes.TwProgram | undefined {
		const node = this.create(nodes.TwProgram)
		while (node.addChild(this.parseTwExpr())) {}
		return this.finish(node)
	}

	public parseTwExpr(): nodes.TwExpression | undefined {
		return this.parseTwGroupTerm() || this.parseTwDeclarationTerm() || this.parseTwRawTerm()
	}

	public parseTwIdentifier(): nodes.TwIdentifier | undefined {
		if (!this.peek(TokenType.Token)) {
			return
		}

		const pos = this.mark()

		const node = this.create(nodes.TwIdentifier)
		node.addChild(this.create(nodes.TwToken))
		this.consumeToken()

		while (true) {
			if (!this.hasWhitespace()) {
				if (this.peek(TokenType.Token)) {
					node.addChild(this.create(nodes.TwToken))
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

		if (!this.hasWhitespace() && this.acceptDelim(":")) {
			const span = new nodes.TwSpan(group.start, group.end)
			span.setVariant(group)
			span.setExpr(this.parseTwExpr())
			return this.finish(span)
		}

		group.important = important || (!this.hasWhitespace() && this.accept(TokenType.Bang))
		return this.finish(group)
	}

	private parseTwRawTerm(): nodes.TwRaw | nodes.TwSpan | undefined {
		const pos = this.mark()
		let important = this.accept(TokenType.Bang)
		if (important && this.hasWhitespace()) {
			this.restoreAtMark(pos)
			return
		}

		const raw = this.create(nodes.TwRaw)
		this.scanner.scope = ScannerScope.Css
		if (!this.accept(TokenType.BracketL)) {
			this.restoreAtMark(pos)
			this.scanner.scope = ScannerScope.Tw
			return
		}

		raw.addChild(this.parseCssDecl())
		this.scanner.scope = ScannerScope.Tw

		if (!this.accept(TokenType.BracketR)) {
			return this.finish(raw, ParseError.RightBracketExpected)
		}

		if (!this.hasWhitespace() && this.acceptDelim(":")) {
			const span = new nodes.TwSpan(raw.start, raw.end)
			span.setVariant(raw)
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
	private parseTwDeclarationTerm(): nodes.TwDeclaration | nodes.TwSpan | undefined {
		const pos = this.mark()

		let important = this.accept(TokenType.Bang)
		if (important && this.hasWhitespace()) {
			this.restoreAtMark(pos)
			return
		}

		const key = this.parseTwIdentifier()
		const decl = this.create(nodes.TwDeclaration)
		if (!decl.setIdentifier(key)) {
			this.restoreAtMark(pos)
			return
		}

		if (!this.hasWhitespace()) {
			switch (key.lastChild?.type) {
				case nodes.NodeType.TwToken:
					if (this.peek(TokenType.BracketL)) {
						this.scanner.scope = ScannerScope.Css
						this.consumeToken()
						decl.setValue(this.parseCssDecl())
						this.scanner.scope = ScannerScope.Tw
						if (!this.accept(TokenType.BracketR)) {
							return this.finish(decl, ParseError.RightBracketExpected)
						}
					}
					break
				case nodes.NodeType.TwSlash:
					if (this.peek(TokenType.BracketL)) {
						this.scanner.scope = ScannerScope.TwModifier
						this.consumeToken()
						decl.setModifier(this.parseTwModifier(true))
						this.scanner.scope = ScannerScope.Tw
						if (!this.accept(TokenType.BracketR)) {
							return this.finish(decl, ParseError.RightBracketExpected)
						}
					}
					break
			}

			// vvv-[]/[]
			if (!this.hasWhitespace() && this.accept(TokenType.Slash)) {
				if (this.peek(TokenType.BracketL)) {
					this.scanner.scope = ScannerScope.TwModifier
					this.consumeToken()
					decl.setModifier(this.parseTwModifier(true))
					this.scanner.scope = ScannerScope.Tw
					if (!this.accept(TokenType.BracketR)) {
						return this.finish(decl, ParseError.RightBracketExpected)
					}
				}
			}
		}

		if (!this.hasWhitespace() && this.acceptDelim(":")) {
			const span = new nodes.TwSpan(decl.start, decl.end)
			span.setVariant(decl)
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
		const node = this.create(nodes.CssDecl)
		const pos = this.mark()
		const tag = this.parseIdentifier()
		const colon = this.acceptDelim(":")
		if (colon) {
			node.setId(tag)
		} else {
			this.restoreAtMark(pos)
		}
		node.setValue(this.parseCssValue())
		return this.finish(node)
	}

	public parseCssValue(): nodes.CssValue | undefined {
		const node = this.create(nodes.CssValue)
		node.addChild(this.parseExpr())
		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this.parseExpr())) {
				break
			}
		}
		return this.finish(node)
	}

	public parseExpr(): nodes.Expression | undefined {
		const node = this.create(nodes.Expression)
		while (node.addChild(this.parseTermExpr())) {}
		return this.finish(node)
	}

	public parseTermExpr(): nodes.Node | undefined {
		return (
			// this._parseUnicodeRange() ||
			this.parseFunction() ||
			this.parseBrackets() ||
			this.parseNamedColor() ||
			this.parseKeywordColor() ||
			this.parseIdentifier() ||
			this.parseStringLiteral() ||
			this.parseHexColor() ||
			this.parseNumeric() ||
			this.parseDelim()
			// this._parseNamedLine()
		)
	}

	public parseUnaryOperator(): nodes.Node | undefined {
		if (!this.peekDelim("+") && !this.peekDelim("-")) {
			return
		}
		const node = this.create(nodes.Node)
		this.consumeToken()
		return this.finish(node)
	}

	public parseFunction(): nodes.Function | undefined {
		const pos = this.mark()
		const node = this.create(nodes.Function)

		if (!node.setIdentifier(this.parseIdentifier())) {
			return
		}

		const fnName = this.prevToken?.getText(this.scanner.source) ?? ""

		if (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos)
			return
		}

		if (colorFunctions.has(fnName.toLowerCase())) {
			const cNode = this.create(nodes.ColorFunction)
			cNode.setIdentifier(node.identifier)
			cNode.setArguments(this.parseCssValue())

			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(cNode, ParseError.RightParenthesisExpected)
			}
			return this.finish(cNode)
		}

		if (fnName.toLowerCase() === "url") {
			// TODO:
		}

		node.setArguments(this.parseCssValue())

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected)
		}
		return this.finish(node)
	}

	// public parseTwGroup(): nodes.TwGroup

	public parseBrackets(): nodes.Brackets | undefined {
		const node = this.create(nodes.Brackets)

		if (this.accept(TokenType.ParenthesisL)) {
			node.setValue(this.parseCssDecl())
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected)
			}
		} else if (this.accept(TokenType.BracketL)) {
			node.brackets = [ASCII.leftBracket, ASCII.rightBracket]
			node.setValue(this.parseCssDecl())
			if (!this.accept(TokenType.BracketR)) {
				return this.finish(node, ParseError.RightBracketExpected)
			}
		} else if (this.accept(TokenType.CurlyL)) {
			node.brackets = [ASCII.leftCurly, ASCII.rightCurly]
			node.setValue(this.parseCssDecl())
			if (!this.accept(TokenType.CurlyR)) {
				return this.finish(node, ParseError.RightCurlyExpected)
			}
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

	public parseDelim(): nodes.Delim | undefined {
		if (this.peek(TokenType.Delim) || this.peek(TokenType.Slash)) {
			const node = this.create(nodes.Delim)
			this.consumeToken()
			return this.finish(node)
		}
	}

	private devNode(n?: nodes.Node) {
		if (!n) {
			return "[null]"
		}
		n.stringProvider = (start, end) => this.scanner.source.slice(start, end)
		return `[${n.start}, ${n.end}] ${n.typeText} "${n.text}"`
	}

	private devToken() {
		return `${this.token.typeText} "${this.token.getText(this.scanner.source)}"`
	}
}
