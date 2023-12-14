import { newScanner } from "./scanner"

interface Token {
	range: [number, number]
	toString(): string
}

interface LegacyParams<T> {
	type: "legacyParams"
	tokens: T[]
}

interface ModernParams<T> {
	type: "modernParams"
	tokens: T[]
}

interface ParamString extends Token {
	type: "string"
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Functions
interface ParamFunction<T> extends Token {
	type: "function"
	name: string
	args: LegacyParams<T> | ModernParams<T>
}

export interface ParamColorFunction<T> extends Token {
	type: "colorFunction"
	name: string
	args: LegacyParams<T> | ModernParams<T>
}

export interface ParamColorKeyword extends Token {
	type: "colorKeyword"
}

export interface ParamColorHexValue extends Token {
	type: "colorHexValue"
}

type V = ParamString | ParamColorKeyword | ParamColorHexValue | ParamFunction<V> | ParamColorFunction<V>

export function parseCssValue(value: string): LegacyParams<V> | ModernParams<V> | undefined {
	const arr = Array.from(newScanner(value))

	return
}
