import { Scanner, Token, TokenType } from "./scanner"
import * as nodes from "./nodes"
import { CSSIssueType, Level, Marker, ParseError } from "./errors"
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

	private inURL = false

	constructor(scnr = new Scanner()) {
		this.scanner = scnr
	}

	public peekRegExp(type: TokenType, regEx: RegExp): boolean {
		if (type !== this.token.type) {
			return false
		}
		return regEx.test(this.token.toString())
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
		error?: CSSIssueType,
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
		error: CSSIssueType,
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

	///////

	// public parseCssValue(): nodes.CssValue | undefined {
	// 	// optional semicolon
	// }

	public parseValue(): nodes.Value | undefined {
		const node = this.create(nodes.Value)

		// children multiple expr, handle comma
		// parseExpr()

		return this.finish(node)
	}

	public parseExpr(): nodes.Expression | undefined {
		const node = this.create(nodes.Expression)

		// children multiple terms, handle space
		// parseTermExpression()

		return this.finish(node)
	}

	public parseTermExpression(): nodes.Node | undefined {
		return (
			// this._parseURILiteral() || // url before function
			// this._parseUnicodeRange() ||
			this.parseFunction() || // function before ident
			this.parseIdentifier() ||
			this.parseStringLiteral() ||
			this.parseNumeric()
			// this._parseHexColor() ||
			// this._parseOperation() ||
			// this._parseNamedLine()
		)
	}

	public parseOperator(): nodes.Operator | undefined {
		if (this.peek(TokenType.Delim) || this.peek(TokenType.Slash)) {
			const node = this.create(nodes.Operator)
			this.consumeToken()
			return this.finish(node)
		}
	}

	public parseUnaryOperator(): nodes.Node | undefined {
		if (!this.peekDelim("+") && !this.peekDelim("-")) {
			return
		}
		const node = this.create(nodes.Node)
		this.consumeToken()
		return this.finish(node)
	}

	private debugToken(t: Token) {
		return t.getText(this.scanner.source)
	}

	private debugCurrent() {
		return '"' + this.token.getText(this.scanner.source) + '"'
	}

	private debugPrev() {
		return '"' + this.prevToken?.getText(this.scanner.source) + '"'
	}

	public parseFunction(): nodes.Function | undefined {
		const pos = this.mark()
		const node = this.create(nodes.Function)

		if (!node.setIdentifier(this.parseFunctionIdentifier())) {
			return
		}

		const fnName = this.prevToken?.getText(this.scanner.source) ?? ""

		if (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos)
			return
		}

		if (colorFunctions.has(fnName)) {
			const color = this.create(nodes.ColorFunction)
			if (!color.setIdentifier(node.getIdentifier())) {
				return
			}

			// TODO:
			const hasComma = this.accept(TokenType.Comma)
			console.log("parse term", this.debugCurrent(), hasComma, this.scanner.pos())

			if (color.getArguments().addChild(this.parseTermExpression())) {
				const modern = !this.accept(TokenType.Comma)
				console.log("parse term color", modern, this.scanner.pos())
				if (modern) {
					let hasOpacity = false

					while (!this.peek(TokenType.EOF)) {
						if (this.peek(TokenType.ParenthesisR)) {
							break
						}

						if (this.accept(TokenType.Slash)) {
							hasOpacity = true
							continue
						}

						if (hasOpacity) {
							console.log("parse term opacity")
							if (!color.setOpacity(this.parseTermExpression())) {
								this.markError(color, ParseError.TermExpected)
							}
							continue
						}

						console.log("parse term color4", this.debugCurrent())
						if (!color.getArguments().addChild(this.parseTermExpression())) {
							this.markError(color, ParseError.TermExpected)
						}
					}

					if (!color.setOpacity(this.parseTermExpression())) {
						this.markError(color, ParseError.TermExpected)
					}
				} else {
					while (!this.peek(TokenType.EOF)) {
						if (this.peek(TokenType.ParenthesisR)) {
							break
						}
						if (!color.getArguments().addChild(this.parseFunctionArgument(true))) {
							this.markError(color, ParseError.ExpressionExpected)
						}
					}
				}
			}

			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(color, ParseError.RightParenthesisExpected)
			}

			return this.finish(color)
		}

		if (node.getArguments().addChild(this.parseFunctionArgument(true))) {
			const hasComma = this.accept(TokenType.Comma)
			while (!this.peek(TokenType.EOF)) {
				if (this.peek(TokenType.ParenthesisR)) {
					break
				}
				if (!node.getArguments().addChild(this.parseFunctionArgument(hasComma))) {
					this.markError(node, ParseError.ExpressionExpected)
				}
			}
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected)
		}
		return this.finish(node)
	}

	public parseFunctionIdentifier(): nodes.Identifier | undefined {
		if (!this.peek(TokenType.Identifier)) {
			return
		}

		const node = this.create(nodes.Identifier)
		node.referenceTypes = [nodes.ReferenceType.Function]
		this.consumeToken()
		return this.finish(node)
	}

	public parseIdentifier(referenceTypes?: nodes.ReferenceType[]): nodes.Identifier | undefined {
		if (!this.peek(TokenType.Identifier)) {
			return
		}
		const node = this.create(nodes.Identifier)
		if (referenceTypes) {
			node.referenceTypes = referenceTypes
		}
		node.isCustomProperty = this.peekRegExp(TokenType.Identifier, /^--/)
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

	public parseNumeric(): nodes.NumericValue | undefined {
		if (this.peek(TokenType.Num) || this.peek(TokenType.Percentage) || this.peek(TokenType.Dimension)) {
			const node = this.create(nodes.NumericValue)
			this.consumeToken()
			return <nodes.NumericValue>this.finish(node)
		}

		return
	}
}
