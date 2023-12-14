export enum ASCII {
	HT = 0x09,
	LF = 0x0a,
	VT = 0x0b,
	FF = 0x0c,
	CR = 0x0d,
	space = 0x20,
	exclarmation = 33,
	doubleQuote = 34,
	singleQuote = 39,
	asterisk = 42,
	hyphen = 45,
	slash = 47,
	backslash = 92,
	leftRoundBracket = 40,
	rightRoundBracket = 41,
	leftSquareBracket = 91,
	rightSquareBracket = 93,
	leftCurlyBracket = 123,
	rightCurlyBracket = 125,

	comma = 0x2c,
}

export enum TokenType {
	EOF = -1,
	string = 0,

	exclarmation = 33,
	doubleQuote = 34,
	singleQuote = 39,
	asterisk = 42,
	hyphen = 45,
	slash = 47,
	backslash = 92,
	leftRoundBracket = 40,
	rightRoundBracket = 41,
	leftSquareBracket = 91,
	rightSquareBracket = 93,
	leftCurlyBracket = 123,
	rightCurlyBracket = 125,

	comma = 0x2c,
}

function toTokenType(c: ASCII) {
	return c as unknown as TokenType
}

function isCharSpace(char: number) {
	if (char === ASCII.space) {
		return true
	}
	if (char >= 0x09 && char <= 0x0d) {
		return true
	}
	return false
}

export interface Token {
	type: TokenType
	range: [number, number]
	toString(): string
}

function newToken(type: TokenType, source: string, a: number, b: number): Token {
	return {
		type,
		range: [a, b],
		toString() {
			return source.slice(a, b)
		},
	}
}

function newReader(source: string) {
	const len = source.length
	let i = 0
	return {
		get index() {
			return i
		},
		set index(v: number) {
			if (v < 0) {
				i = 0
				return
			}
			if (v > len) {
				i = len
				return
			}
			i = v
		},
		nextChar() {
			// NaN: eof
			return source.charCodeAt(i++)
		},
	}
}

enum ScannerState {
	Idle,
	URLFunction,
	SingleQuote,
	DoubleQuote,
}

export function newScanner(source: string) {
	const r = newReader(source)

	let state = ScannerState.Idle
	let backslash = false

	return {
		[Symbol.iterator]() {
			return this
		},
		next(): IteratorResult<Token> {
			let a = -1
			let b = -1

			while (true) {
				const c = r.nextChar()
				const i = r.index

				switch (state) {
					case ScannerState.Idle: {
						if (Number.isNaN(c)) {
							// string
							if (b > a) {
								return { value: newToken(TokenType.string, source, a, b) }
							}
							return { value: newToken(TokenType.EOF, source, i, i), done: true }
						}

						if (isCharSpace(c)) {
							// string
							if (b > a) {
								return { value: newToken(TokenType.string, source, a, b) }
							}
							continue
						}

						switch (c) {
							case ASCII.leftRoundBracket:
							case ASCII.rightRoundBracket:
							case ASCII.leftSquareBracket:
							case ASCII.rightSquareBracket:
							case ASCII.leftCurlyBracket:
							case ASCII.rightCurlyBracket:
							case ASCII.slash:
							case ASCII.comma:
								if (b > a) {
									if (c === ASCII.leftRoundBracket && b === i - 1) {
										const name = source.slice(a, b)
										if (name === "url") {
											state = ScannerState.URLFunction
										}
									}

									r.index = i - 1
									return { value: newToken(TokenType.string, source, a, b) }
								}
								return { value: newToken(toTokenType(c), source, i - 1, i) }
						}

						if (a === -1) {
							a = i - 1
						}
						b = i

						break
					}
					case ScannerState.URLFunction: {
						if (Number.isNaN(c)) {
							// string
							if (b > a) {
								return { value: newToken(TokenType.string, source, a, b) }
							}
							return { value: newToken(TokenType.EOF, source, i, i), done: true }
						}

						if (isCharSpace(c)) {
							// string
							if (b > a) {
								return { value: newToken(TokenType.string, source, a, b) }
							}
							continue
						}

						switch (c) {
							case ASCII.backslash:
								if (!backslash) {
									backslash = true
								}
								break
							case ASCII.leftRoundBracket:
							case ASCII.rightRoundBracket:
								if (!backslash) {
									if (c === ASCII.rightRoundBracket) {
										state = ScannerState.Idle
									}
									if (b > a) {
										r.index = i - 1
										return { value: newToken(TokenType.string, source, a, b) }
									}
									return { value: newToken(toTokenType(c), source, i - 1, i) }
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
		},
	}
}
