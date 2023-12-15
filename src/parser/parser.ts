import { ExprScanner, Token, TokenType } from "./scanner"
import * as nodes from "./nodes"

export class Parser {
	public scanner: ExprScanner
	public token: Token
	public prevToken?: Token
	private lastErrorToken?: Token
	private inURL = false

	constructor(scnr = new ExprScanner()) {
		this.scanner = scnr
		this.token = scnr.finishToken(TokenType.EOF, -1, -1)
	}

	public consumeToken(): void {
		this.prevToken = this.token
		this.token = this.scanner.next().value
	}

	public peekRegExp(type: TokenType, regEx: RegExp): boolean {
		if (type !== this.token.type) {
			return false
		}
		return regEx.test(this.token.toString())
	}

	////

	// public _parseExpr(stopOnComma: boolean = false): nodes.Expression | null {
	// 	const node = this.create(nodes.Expression)
	// 	if (!node.addChild(this._parseBinaryExpr())) {
	// 		return null
	// 	}

	// 	while (true) {
	// 		if (this.peek(TokenType.Comma)) {
	// 			// optional
	// 			if (stopOnComma) {
	// 				return this.finish(node)
	// 			}
	// 			this.consumeToken()
	// 		}
	// 		if (!node.addChild(this._parseBinaryExpr())) {
	// 			break
	// 		}
	// 	}

	// 	return this.finish(node)
	// }

	// public _parseBinaryExpr(
	// 	preparsedLeft?: nodes.BinaryExpression,
	// 	preparsedOper?: nodes.Node,
	// ): nodes.BinaryExpression | null {
	// 	let node = this.create(nodes.BinaryExpression)

	// 	if (!node.setLeft(<nodes.Node>preparsedLeft || this._parseTerm())) {
	// 		return null
	// 	}

	// 	if (!node.setOperator(preparsedOper || this._parseOperator())) {
	// 		return this.finish(node)
	// 	}

	// 	if (!node.setRight(this._parseTerm())) {
	// 		return this.finish(node, ParseError.TermExpected)
	// 	}

	// 	// things needed for multiple binary expressions
	// 	node = <nodes.BinaryExpression>this.finish(node)
	// 	const operator = this._parseOperator()
	// 	if (operator) {
	// 		node = <nodes.BinaryExpression>this._parseBinaryExpr(node, operator)
	// 	}

	// 	return this.finish(node)
	// }

	// public _parseTerm(): nodes.Term | null {
	// 	let node = this.create(nodes.Term)
	// 	node.setOperator(this._parseUnaryOperator()) // optional

	// 	if (node.setExpression(this._parseTermExpression())) {
	// 		return <nodes.Term>this.finish(node)
	// 	}

	// 	return null
	// }

	// public _parseTermExpression(): nodes.Node | null {
	// 	return (
	// 		this._parseURILiteral() || // url before function
	// 		this._parseUnicodeRange() ||
	// 		this._parseFunction() || // function before ident
	// 		this._parseIdent() ||
	// 		this._parseStringLiteral() ||
	// 		this._parseNumeric() ||
	// 		this._parseHexColor() ||
	// 		this._parseOperation() ||
	// 		this._parseNamedLine()
	// 	)
	// }

	public _parseFunction(): nodes.Function | null {
		const pos = this.mark()
		const node = this.create(nodes.Function)

		if (!node.setIdentifier(this._parseFunctionIdentifier())) {
			return null
		}

		if (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos)
			return null
		}

		if (node.getArguments().addChild(this._parseFunctionArgument())) {
			while (this.accept(TokenType.Comma)) {
				if (this.peek(TokenType.ParenthesisR)) {
					break
				}
				if (!node.getArguments().addChild(this._parseFunctionArgument())) {
					this.markError(node, ParseError.ExpressionExpected)
				}
			}
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return <nodes.Function>this.finish(node, ParseError.RightParenthesisExpected)
		}
		return <nodes.Function>this.finish(node)
	}

	public parseIdent(referenceTypes?: nodes.ReferenceType[]): nodes.Identifier | null {
		if (!this.peek(TokenType.Ident)) {
			return null
		}
		const node = this.create(nodes.Identifier)
		if (referenceTypes) {
			node.referenceTypes = referenceTypes
		}
		node.isCustomProperty = this.peekRegExp(TokenType.Ident, /^--/)
		this.consumeToken()
		return this.finish(node)
	}
}
