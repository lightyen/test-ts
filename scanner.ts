export enum ASCII {
	TAB = "\t".charCodeAt(0),
	LF = "\n".charCodeAt(0),
	VT = "\v".charCodeAt(0),
	FF = "\f".charCodeAt(0),
	CR = "\r".charCodeAt(0),

	_a = "a".charCodeAt(0),
	_f = "f".charCodeAt(0),
	_z = "z".charCodeAt(0),
	_A = "A".charCodeAt(0),
	_F = "F".charCodeAt(0),
	_Z = "Z".charCodeAt(0),
	_0 = "0".charCodeAt(0),
	_9 = "9".charCodeAt(0),

	whitespace = " ".charCodeAt(0),
	bang = "!".charCodeAt(0),
	doubleQuote = '"'.charCodeAt(0),
	singleQuote = "'".charCodeAt(0),
	asterisk = "*".charCodeAt(0),
	hyphen = "-".charCodeAt(0),
	slash = "/".charCodeAt(0),
	backslash = "\\".charCodeAt(0),

	leftParenthesis = "(".charCodeAt(0),
	rightParenthesis = ")".charCodeAt(0),
	leftBracket = "[".charCodeAt(0),
	rightBracket = "]".charCodeAt(0),
	leftCurly = "{".charCodeAt(0),
	rightCurly = "}".charCodeAt(0),
	leftThan = "<".charCodeAt(0),
	rightThan = ">".charCodeAt(0),

	hash = "#".charCodeAt(0),
	at = "@".charCodeAt(0),
	question = "?".charCodeAt(0),
	plus = "+".charCodeAt(0),
	comma = ",".charCodeAt(0),
	dot = ".".charCodeAt(0),
	semicolon = ";".charCodeAt(0),
	colon = ":".charCodeAt(0),
	percent = "%".charCodeAt(0),
	underscore = "_".charCodeAt(0),
}

function isCharSpace(char: number) {
	if (char === ASCII.whitespace) {
		return true
	}
	if (char >= 0x09 && char <= 0x0d) {
		return true
	}
	return false
}

export enum TokenType {
	EOF,
	Ident,
	String, // quoted
	SemiColon,
	Exclamation,
	Comma,
	ParenthesisL,
	ParenthesisR,
	BracketL,
	BracketR,

	// bang = ASCII.bang,
	// doubleQuote = ASCII.doubleQuote,
	// singleQuote = ASCII.singleQuote,
	// asterisk = ASCII.asterisk,
	// hyphen = ASCII.hyphen,
	// slash = ASCII.slash,
	// backslash = ASCII.backslash,
	// leftParenthesis = ASCII.leftParenthesis,
	// rightParenthesis = ASCII.rightParenthesis,
	// leftBracket = ASCII.leftBracket,
	// rightBracket = ASCII.rightBracket,
	// leftCurly = ASCII.leftCurly,
	// rightCurly = ASCII.rightCurly,

	comma = ASCII.comma,
}

const staticTokenTable: Record<number, TokenType> = {}
staticTokenTable[ASCII.semicolon] = TokenType.SemiColon
staticTokenTable[ASCII.leftBracket] = TokenType.BracketL
staticTokenTable[ASCII.rightBracket] = TokenType.BracketR
staticTokenTable[ASCII.leftParenthesis] = TokenType.ParenthesisL
staticTokenTable[ASCII.rightParenthesis] = TokenType.ParenthesisR
staticTokenTable[ASCII.comma] = TokenType.Comma

export interface Token {
	type: TokenType
	range: [number, number]
	toString(): string
}

export class Reader {
	private source: string
	private len: number
	private position: number
	constructor(input: string) {
		this.source = input
		this.len = input.length
		this.position = 0
	}

	public slice(a: number, b?: number) {
		return this.source.slice(a, b)
	}

	public nextChar() {
		return this.source.charCodeAt(this.position++) || 0
	}

	public peekChar(n = 0) {
		this.source.charCodeAt(this.position + n) || 0
	}

	public pos() {
		return this.position
	}

	public goBack(n: number) {
		this.position -= n
	}

	public goAdd(n: number) {
		this.position += n
	}

	public goTo(n: number) {
		this.position = n
	}

	public goIfChar(ch: number): boolean {
		if (ch === this.source.charCodeAt(this.position)) {
			this.position++
			return true
		}
		return false
	}

	public goIfChars(ch: number[]): boolean {
		if (this.position + ch.length > this.source.length) {
			return false
		}
		let i = 0
		for (; i < ch.length; i++) {
			if (this.source.charCodeAt(this.position + i) !== ch[i]) {
				return false
			}
		}
		this.goAdd(i)
		return true
	}

	public goWhileChar(condition: (ch: number) => boolean): number {
		const posNow = this.position
		while (this.position < this.len && condition(this.source.charCodeAt(this.position))) {
			this.position++
		}
		return this.position - posNow
	}

	public eos(): boolean {
		return this.len <= this.position
	}
}

enum ScannerState {
	Idle,
	URLFunction,
	SingleQuote,
	DoubleQuote,
}

export class ExprScanner {
	private stream = new Reader("")
	public inURL = false

	constructor(input = "") {
		this.stream = new Reader(input)
	}

	public setSource(input: string) {
		this.stream = new Reader(input)
	}

	public finishToken(type: TokenType, a: number, b: number): Token {
		const toString = () => {
			return this.stream.slice(a, b)
		}
		return {
			type,
			range: [a, b],
			toString,
		}
	}

	public whitespace(): boolean {
		const n = this.stream.goWhileChar(
			ch => ch === ASCII.whitespace || ch === ASCII.TAB || ch === ASCII.LF || ch === ASCII.FF || ch === ASCII.CR,
		)
		return n > 0
	}

	public comment(): boolean {
		if (this.stream.goIfChars([ASCII.slash, ASCII.asterisk])) {
			let success = false
			let hot = false
			this.stream.goWhileChar(ch => {
				if (hot && ch === ASCII.slash) {
					success = true
					return false
				}
				hot = ch === ASCII.asterisk
				return true
			})
			if (success) {
				this.stream.goAdd(1)
			}
			return true
		}
		return false
	}

	public trivia() {
		while (true) {
			// const offset = stream.pos()
			if (this.whitespace()) {
				//
			} else if (this.comment()) {
				//
			} else {
				return null
			}
		}
	}

	[Symbol.iterator]() {
		return this
	}

	public next(): IteratorResult<Token> {
		this.trivia()
		const offset = this.stream.pos()
		if (this.stream.eos()) {
			return { value: this.finishToken(TokenType.EOF, offset, offset), done: true }
		}
		return { value: this.scanNext(offset) }
	}

	public scanNext(offset: number): Token {
		let a = -1
		let b = -1

		while (true) {
			const c = this.stream.nextChar()
			const i = this.stream.pos()

			switch (state) {
				case ScannerState.Idle: {
					if (c === 0) {
						if (b > a) {
							return { value: newToken(TokenType.Ident, source, a, b) }
						}
						return { value: newToken(TokenType.EOF, source, i, i), done: true }
					}

					if (isCharSpace(c)) {
						if (b > a) {
							return { value: newToken(TokenType.Ident, source, a, b) }
						}
						continue
					}

					switch (c) {
						case ASCII.leftParenthesis:
						case ASCII.rightParenthesis:
						case ASCII.leftBracket:
						case ASCII.rightBracket:
						case ASCII.leftCurly:
						case ASCII.rightCurly:
						case ASCII.slash:
						case ASCII.comma:
							if (b > a) {
								if (c === ASCII.leftParenthesis && b === i - 1) {
									const name = source.slice(a, b)
									if (name === "url") {
										state = ScannerState.URLFunction
									}
								}

								stream.goBack(1)
								return { value: newToken(TokenType.Ident, source, a, b) }
							}
							return { value: newToken(staticTokenTable[c], source, i - 1, i) }
					}

					if (a === -1) {
						a = i - 1
					}
					b = i

					break
				}
				case ScannerState.URLFunction: {
					if (Number.isNaN(c)) {
						if (b > a) {
							return { value: newToken(TokenType.Ident, source, a, b) }
						}
						return { value: newToken(TokenType.EOF, source, i, i), done: true }
					}

					if (isCharSpace(c)) {
						if (b > a) {
							return { value: newToken(TokenType.Ident, source, a, b) }
						}
						continue
					}

					switch (c) {
						case ASCII.backslash:
							if (!backslash) {
								backslash = true
							}
							break
						case ASCII.leftParenthesis:
						case ASCII.rightParenthesis:
							if (!backslash) {
								if (c === ASCII.rightParenthesis) {
									state = ScannerState.Idle
								}
								if (b > a) {
									stream.goBack(1)
									return { value: newToken(TokenType.Ident, source, a, b) }
								}
								return { value: newToken(staticTokenTable[c], source, i - 1, i) }
							}
							backslash = false
					}

					if (a === -1) {
						a = i - 1
					}
					b = i

					break
				}
			}
		}
	}
}
