import { Marker } from "./errors"
import * as ASCII from "./ascii"
import { namedColors, hsl2color } from "./color"
import * as u from "./is"
export * from "./is"

export interface VisitorFunction {
	(node: Node): boolean
}

export enum NodeType {
	Undefined,

	CssDecl,
	CssValue,
	CssExpression,

	ColorFunction,
	ThemeLiteral,
	URILiteral,
	UnicodeRange,
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

	TwProgram,

	TwGroup,
	TwDecl,
	TwRaw,

	TwSpan,

	TwModifier,
	TwIdentifier,
	TwLiteral,
	Hyphen,
	TwSlash,

	TwThemeIdentifier,
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
	private _children?: Node[]
	public issues?: Marker[]
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
		if (node.parent && node.parent._children) {
			const idx = node.parent._children.indexOf(node)
			if (idx >= 0) {
				node.parent._children.splice(idx, 1)
			}
		}
		node.parent = this
		if (!this._children) {
			this._children = []
		}
		let children = this._children
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

	public addChild<T extends Node>(node?: T): node is T {
		return this.setNode(node, undefined, node => this.updateRange(node))
	}

	public hasChildren(): boolean {
		return Boolean(this._children?.length)
	}

	public get children(): Node[] {
		return this._children ? this._children.slice() : []
	}

	public get firstChild(): Node | undefined {
		if (this._children?.length) {
			return this._children[0]
		}
		return undefined
	}

	public get lastChild(): Node | undefined {
		if (this._children?.length) {
			return this._children[this._children.length - 1]
		}
		return undefined
	}

	public updateRange(node: Node) {
		if (node.start < this.start || this.start === -1) {
			this.start = node.start
		}
		if (node.end > this.end || this.end === -1) {
			this.end = node.end
		}
	}

	public collectIssues(results: Marker[]) {
		if (this.issues) {
			results.push.apply(results, this.issues)
		}
	}

	public addIssue(issue: Marker): void {
		if (!this.issues) {
			this.issues = []
		}
		this.issues.push(issue)
	}

	public isErroneous(recursive = false): boolean {
		if (this.issues && this.issues.length > 0) {
			return true
		}
		return recursive && Array.isArray(this.children) && this.children.some(c => c.isErroneous(true))
	}

	public visit(visitor: VisitorFunction) {
		if (visitor(this) && this.children) {
			for (const child of this.children) {
				child.visit(visitor)
			}
		}
	}
}

export class Nodelist extends Node {
	constructor(parent: Node, index: number = -1) {
		super()
		this.attachTo(parent, index)
	}
}

export class UnicodeRange extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.UnicodeRange)
	}
}

export class CssDecl extends Node {
	public id?: Identifier
	public value?: CssValue

	constructor(start: number, end: number) {
		super(start, end, NodeType.CssDecl)
	}

	public setId(node?: Identifier): node is Identifier {
		return this.setNode(node, 0, node => {
			this.id = node
			this.updateRange(node)
		})
	}

	public setValue(node?: CssValue): node is CssValue {
		return this.setNode(node, 0, node => {
			this.value = node
			this.updateRange(node)
		})
	}
}

export class CssValue extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.CssValue)
	}
}

export class CssExpression extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.CssExpression)
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

export class TwIdentifier extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwIdentifier)
	}
}

export class TwThemeIdentifier extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwThemeIdentifier)
	}
}

export class TwLiteral extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwLiteral)
	}
}

export class Hyphen extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.Hyphen)
	}
}

export class TwSlash extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwSlash)
	}
}

export class Delim extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.Delim)
	}
}

export class Brackets extends Node {
	public brackets: [number, number]

	constructor(start: number, end: number) {
		super(start, end, NodeType.Parentheses)
		this.brackets = [ASCII.leftParenthesis, ASCII.rightParenthesis]
	}
}

export class Function extends Node {
	public identifier?: Identifier
	public arguments?: CssValue

	constructor(start: number, end: number) {
		super(start, end, NodeType.Function)
	}

	public setIdentifier(node?: Identifier): node is Identifier {
		return this.setNode(node, 0, node => {
			this.identifier = node
			this.updateRange(node)
		})
	}

	public getName(): string {
		return this.identifier?.text ?? ""
	}

	public setArguments(node?: CssValue): node is CssValue {
		return this.setNode(node, 0, node => {
			this.arguments = node
			this.updateRange(node)
		})
	}
}

export class ColorFunction extends Function {
	private _c?: number[] | null
	private _a?: number | null
	private _name?: string | null
	private _space?: string | null

	constructor(start: number, end: number) {
		super(start, end)
		this.type = NodeType.ColorFunction
	}

	static from(node: Function) {
		const v = new ColorFunction(node.start, node.end)
		v.setIdentifier(node.identifier)
		return v
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

	public get name(): string {
		if (this._name === undefined) {
			this.initColor()
		}
		return this._name!
	}

	public get space(): string {
		if (this._space === undefined) {
			this.initColor()
		}
		return this._space!
	}

	private initColor() {
		const expressions = this.arguments?.children

		if (!expressions || expressions.length === 0) {
			this._a = 0
			this._c = [0, 0, 0]
			this._name = null
			this._space = null
			return
		}

		let ch: number[] = []
		const fnName = this.getName().toLowerCase()

		const legacy = expressions.length > 1
		if (legacy) {
			for (let i = 0; i < 3; i++) {
				const node = expressions[i]
				ch[i] = 0
				if (u.isNumericValue(node)) {
					const { value, unit } = node.getValue()
					if (unit == null) {
						ch[i] = parseFloat(value)
					} else if (unit === "%") {
						ch[i] = parseFloat(value) / 100.0
					}
				}
			}

			if (fnName.slice(0, 3) === "rgb") {
				ch = ch.map(v => v / 255.0)
				this._name = fnName.slice(0, 3)
			} else if (fnName.slice(0, 3) === "hsl") {
				ch = hsl2color(ch[0], ch[1], ch[2])
				this._name = fnName.slice(0, 3)
			} else {
				this._name = fnName
			}

			this._c = ch
			this._a = null
			this._space = null

			if (expressions[3]) {
				const node = expressions[3].children[0]
				if (u.isNumericValue(node)) {
					const { value, unit } = node.getValue()
					this._a = parseFloat(value)
					if (unit === "%") {
						this._a = this._a / 100.0
					}
				}
			}

			return
		}

		let terms = expressions[0].children

		if (fnName === "color") {
			this._space = terms[0]?.text.toLowerCase() ?? null
			terms = terms.slice(1)
		} else {
			this._space = null
		}

		for (let i = 0; i < 3; i++) {
			const node = terms[i]
			ch[i] = 0

			if (u.isNumericValue(node)) {
				const { value, unit } = node.getValue()
				if (unit == null) {
					ch[i] = parseFloat(value)
				} else if (unit === "%") {
					ch[i] = parseFloat(value) / 100.0
				}
			}
		}

		if (fnName.slice(0, 3) === "rgb") {
			ch = ch.map(v => v / 255.0)
			this._name = fnName.slice(0, 3)
		} else if (fnName.slice(0, 3) === "hsl") {
			ch = hsl2color(ch[0], ch[1], ch[2])
			this._name = fnName.slice(0, 3)
		} else {
			this._name = fnName
		}

		this._c = ch
		this._a = null

		const node = terms[4]
		if (u.isNumericValue(node)) {
			const { value, unit } = node.getValue()
			this._a = parseFloat(value)
			if (unit === "%") {
				this._a = this._a / 100.0
			}
		}
	}
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

export class KeywordColorValue extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.KeywordColorValue)
	}
}

export class TwProgram extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwProgram)
	}
}

export type TwExpression = TwDecl | TwGroup | TwRaw | TwSpan

export class TwModifier extends Node {
	public wrapped: boolean
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwModifier)
	}
}

class __TwNode extends Node {
	public identifier?: TwIdentifier
	public modifier?: TwModifier
	public value?: CssDecl

	constructor(start: number, end: number) {
		super(start, end, NodeType.Undefined)
	}

	public setIdentifier(node?: TwIdentifier): node is TwIdentifier {
		return this.setNode(node, 0, node => {
			this.identifier = node
			this.updateRange(node)
		})
	}

	public setValue(node?: CssDecl): node is CssDecl {
		return this.setNode(node, 0, node => {
			this.value = node
			this.updateRange(node)
		})
	}

	public setModifier(node?: TwModifier): node is TwModifier {
		return this.setNode(node, 0, node => {
			this.modifier = node
			this.updateRange(node)
		})
	}
}

export class TwDecl extends __TwNode {
	public minus = false
	public important = false
	constructor(start: number, end: number) {
		super(start, end)
		this.type = NodeType.TwDecl
	}
}

export class TwGroup extends Node {
	public important = false
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwGroup)
	}
}

export class TwRaw extends Node {
	public important = false
	constructor(start: number, end: number) {
		super(start, end, NodeType.TwRaw)
	}
}

export class TwSpan extends Node {
	public variant?: TwDecl | TwGroup | TwRaw
	public expr?: TwExpression

	constructor(start: number, end: number) {
		super(start, end, NodeType.TwSpan)
	}

	public setVariant<T extends TwDecl | TwGroup | TwRaw>(node?: T): node is T {
		return this.setNode(node, 0, node => {
			this.variant = node
			this.updateRange(node)
		})
	}

	public setExpr(node?: TwExpression): node is TwExpression {
		return this.setNode(node, 0, node => {
			this.expr = node
			this.updateRange(node)
		})
	}
}

export class TwNormalVariantSpan extends TwSpan {
	public variant?: TwDecl
	public expr?: TwExpression

	constructor(start: number, end: number) {
		super(start, end)
	}
}

export class TwGroupVariantSpan extends TwSpan {
	public variant?: TwGroup
	public expr?: TwExpression

	constructor(start: number, end: number) {
		super(start, end)
	}
}

export class TwRawVariantSpan extends TwSpan {
	public variant?: TwRaw
	public expr?: TwExpression

	constructor(start: number, end: number) {
		super(start, end)
	}
}

export class ThemeLiteral extends Function {
	constructor(start: number, end: number) {
		super(start, end)
		this.type = NodeType.ThemeLiteral
	}
}

export function collectParseError(node: Node) {
	const entries: Marker[] = []
	node.visit(node => {
		if (node.isErroneous()) {
			node.collectIssues(entries)
		}
		return true
	})
	return entries
}
