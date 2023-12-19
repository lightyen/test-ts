import { Marker } from "./errors"
import * as ASCII from "./ascii"
import { namedColors } from "./colorNames"

export enum NodeType {
	Undefined,
	CssValue,

	Value,
	Expression,

	ColorFunction,
	URILiteral,
	Function,
	Parentheses,

	HexColorValue,
	Delim,

	Dimension,
	NumericValue,

	NamedColorValue,
	KeywordColorValue,

	StringLiteral,
	Identifier,
}

export interface StringProvider {
	(start: number, end: number): string
}

export interface NodeConstructor<T> {
	new (start: number, end: number): T
}

export class Node {
	private nodeType: NodeType | undefined
	public start: number
	public end: number
	public source: string
	public parent?: Node
	public children: Node[] | undefined
	public issues: Marker[] | undefined
	public stringProvider: StringProvider | undefined

	constructor(start = -1, end = -1, nodeType?: NodeType) {
		this.start = start
		this.end = end
		if (nodeType) {
			this.nodeType = nodeType
		}
	}

	public set type(type: NodeType) {
		this.nodeType = type
	}

	public get type(): NodeType {
		return this.nodeType ?? NodeType.Undefined
	}

	public get typeText(): string {
		return "#" + NodeType[this.type]
	}

	public getStringProvider(): StringProvider {
		let node: Node | undefined = this
		while (node && !node.stringProvider) {
			node = node.parent
		}
		return node?.stringProvider ?? (() => "unknown")
	}

	public get length(): number {
		const l = this.end - this.start
		return l < 0 ? 0 : l
	}

	public get text(): string {
		return this.getStringProvider()(this.start, this.end)
	}

	public startsWith(str: string): boolean {
		return this.length >= str.length && this.getStringProvider()(this.start, this.start + str.length) === str
	}

	public endsWith(str: string): boolean {
		return this.length >= str.length && this.getStringProvider()(this.end - str.length, str.length) === str
	}

	public adoptChild(node: Node, index: number = -1): Node {
		if (node.parent && node.parent.children) {
			const idx = node.parent.children.indexOf(node)
			if (idx >= 0) {
				node.parent.children.splice(idx, 1)
			}
		}
		node.parent = this
		if (!this.children) {
			this.children = []
		}
		let children = this.children
		if (index !== -1) {
			children.splice(index, 0, node)
		} else {
			children.push(node)
		}
		return node
	}

	public attachTo(parent: Node, index = -1): Node {
		parent.adoptChild(this, index)
		return this
	}

	public setNode<T extends Node>(node?: T, index = -1, callback?: (node: T) => void): node is T {
		if (node) {
			node.attachTo(this, index)
			callback?.(node)
			return true
		}
		return false
	}

	public addChild(node?: Node): node is Node {
		return this.setNode(node, undefined, node => this.updateRange(node))
	}

	public hasChildren(): boolean {
		return Boolean(this.children?.length)
	}

	public getChildren(): Node[] {
		return this.children ? this.children.slice() : []
	}

	public updateRange(node: Node) {
		if (node.start < this.start || this.start === -1) {
			this.start = node.start
		}
		if (node.end > this.end || this.end === -1) {
			this.end = node.end
		}
	}

	public addIssue(issue: Marker): void {
		if (!this.issues) {
			this.issues = []
		}
		this.issues.push(issue)
	}
}

export class Nodelist extends Node {
	constructor(parent: Node, index: number = -1) {
		super()
		this.attachTo(parent, index)
	}
}

export class CssValue extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.CssValue)
	}
}

export class Value extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.Value)
	}
}

export class Expression extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.Expression)
	}
}

export class Identifier extends Node {
	public isCustomProperty = false

	constructor(start: number, end: number) {
		super(start, end, NodeType.Identifier)
	}
}

export class StringLiteral extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.StringLiteral)
	}
}

export class Delim extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.Delim)
	}
}

export class Parentheses extends Node {
	public arguments?: Value
	public bracket: [number, number]

	constructor(start: number, end: number) {
		super(start, end, NodeType.Parentheses)
		this.bracket = [ASCII.leftParenthesis, ASCII.rightParenthesis]
	}

	public getArguments(): Value | undefined {
		return this.arguments
	}

	public setArguments(node?: Value): node is Value {
		return this.setNode(node, 0, node => {
			this.arguments = node
			this.updateRange(node)
		})
	}
}

export class Function extends Node {
	public identifier?: Identifier
	public arguments?: Value

	constructor(start: number, end: number) {
		super(start, end, NodeType.Function)
	}

	public setIdentifier(node?: Identifier): node is Identifier {
		return this.setNode(node, 0, node => {
			this.identifier = node
			this.updateRange(node)
		})
	}

	public getArguments(): Value | undefined {
		return this.arguments
	}

	public setArguments(node?: Value): node is Value {
		return this.setNode(node, 0, node => {
			this.arguments = node
			this.updateRange(node)
		})
	}

	public getIdentifier() {
		return this.identifier
	}

	public getName(): string {
		return this.identifier?.text ?? ""
	}
}

export class ColorFunction extends Function {
	private _c?: number[] | null
	private _a?: number | null

	constructor(start: number, end: number) {
		super(start, end)
	}

	public get type(): NodeType {
		return NodeType.ColorFunction
	}

	public get channels(): number[] {
		if (this._c === undefined) {
			this.initColor()
		}
		return this._c!
	}

	public get a(): number {
		if (this._a === undefined) {
			this.initColor()
		}
		return this._a!
	}

	private initColor() {
		const expresions = this.getArguments()?.getChildren()
		if (!expresions || expresions.length === 0) {
			return
		}

		let ch: number[] = []
		const fnName = this.getName().toLowerCase()

		const legacy = expresions.length > 1
		if (legacy) {
			for (let i = 0; i < 3; i++) {
				const node = expresions[i].getChildren()[0]
				ch[i] = 0
				if (isNumericValue(node)) {
					const { value, unit } = node.getValue()
					if (unit == null) {
						if (fnName.startsWith("rgb")) {
							// TODO: hsl
							ch[i] = parseFloat(value) / 255.0
						} else {
							ch[i] = parseFloat(value)
						}
					} else if (unit === "%") {
						ch[i] = parseFloat(value) / 100.0
					}
				}
			}

			this._c = ch
			this._a = null

			if (expresions[3]) {
				const node = expresions[3].getChildren()[0]
				if (isNumericValue(node)) {
					const { value, unit } = node.getValue()
					this._a = parseFloat(value)
					if (unit === "%") {
						this._a = this._a / 100.0
					}
				}
			}

			return
		}

		let terms = expresions[0].getChildren()
		if (fnName === "color") {
			terms = terms.slice(1)
		}

		for (let i = 0; i < 3; i++) {
			const node = terms[i]
			ch[i] = 0
			if (isNumericValue(node)) {
				const { value, unit } = node.getValue()
				if (unit == null) {
					if (fnName.startsWith("rgb")) {
						ch[i] = parseFloat(value) / 255.0
					} else {
						ch[i] = parseFloat(value)
					}
				} else if (unit === "%") {
					ch[i] = parseFloat(value) / 100.0
				}
			}
		}

		this._c = ch
		this._a = null

		const node = terms[4]
		if (isNumericValue(node)) {
			const { value, unit } = node.getValue()
			this._a = parseFloat(value)
			if (unit === "%") {
				this._a = this._a / 100.0
			}
		}
	}
}

export function isColorFunction(node?: Node): node is ColorFunction {
	return node?.type === NodeType.ColorFunction
}

export class NumericValue extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.NumericValue)
	}

	public getValue(): { value: string; unit?: string } {
		const raw = this.text
		let unitIdx = 0
		let code: number
		for (let i = 0, len = raw.length; i < len; i++) {
			code = raw.charCodeAt(i)

			if (!((ASCII._0 <= code && code <= ASCII._9) || code === ASCII.dot)) {
				break
			}
			unitIdx += 1
		}
		return {
			value: raw.slice(0, unitIdx),
			unit: unitIdx < raw.length ? raw.slice(unitIdx) : undefined,
		}
	}
}

export function isNumericValue(node?: Node): node is NumericValue {
	return node?.type === NodeType.NumericValue
}

export class HexColorValue extends Node {
	private _c?: number[] | null
	private _a?: number | null

	constructor(start: number, end: number) {
		super(start, end, NodeType.HexColorValue)
	}

	public get channels(): number[] {
		if (this._c === undefined) {
			this.initColor()
		}
		return this._c!
	}

	public get a(): number {
		if (this._a === undefined) {
			this.initColor()
		}
		return this._a!
	}

	private initColor() {
		const value = this.text.slice(1)
		let ch: number[] = []
		if (value.length >= 6) {
			const v = parseInt(value.slice(0, 6), 16)
			ch[0] = ((v & 0xff0000) >> 16) / 255.0
			ch[1] = ((v & 0x00ff00) >> 8) / 255.0
			ch[2] = (v & 0x0000ff) / 255.0
			this._c = ch
			this._a = null
			if (value.length === 8) {
				this._a = parseInt(value.slice(6, 8), 16) / 255.0
			}
		} else {
			const v = parseInt(value.slice(0, 3), 16)
			ch[0] = v & 0xf00
			ch[1] = v & 0x0f0
			ch[2] = v & 0x00f
			ch[0] = ((ch[0] << 12) | (ch[0] << 8)) / 255.0
			ch[1] = ((ch[1] << 8) | (ch[1] << 4)) / 255.0
			ch[2] = ((ch[2] << 4) | ch[2]) / 255.0
			this._c = ch
			this._a = null
			if (value.length === 4) {
				this._a = parseInt(value.slice(3, 4), 16) / 255.0
			}
		}
	}
}

export function isHexColorValue(node?: Node): node is HexColorValue {
	return node?.type === NodeType.HexColorValue
}

export class NamedColorValue extends Node {
	private _c?: number[] | null
	private _a?: number | null

	constructor(start: number, end: number) {
		super(start, end, NodeType.NamedColorValue)
	}

	public get channels(): number[] {
		if (this._c === undefined) {
			this.initColor()
		}
		return this._c!
	}

	public get a(): number {
		if (this._a === undefined) {
			this.initColor()
		}
		return this._a!
	}

	private initColor() {
		const name = this.text
		this._c = namedColors[name]
		this._a = null
	}
}

export function isNamedColorValue(node?: Node): node is NamedColorValue {
	return node?.type === NodeType.NamedColorValue
}

export class KeywordColorValue extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.KeywordColorValue)
	}
}

export function isKeywordColorValue(node?: Node): node is KeywordColorValue {
	return node?.type === NodeType.KeywordColorValue
}
