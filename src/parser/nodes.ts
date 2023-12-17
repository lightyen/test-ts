import { Marker } from "./errors"
import * as ASCII from "./ascii"

export enum NodeType {
	Undefined,
	Identifier,
	Expression,
	BinaryExpression,
	Term,
	Operator,
	Value,
	StringLiteral,
	URILiteral,
	Invocation,
	ColorFunction,
	Function,
	FunctionArgument,
	NumericValue,
	HexColorValue,
}

export enum ReferenceType {
	Function,
	ColorFunction,
	Unknown,
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

export class Identifier extends Node {
	public referenceTypes?: ReferenceType[]
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

export class Expression extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.Expression)
	}
}

export class BinaryExpression extends Node {
	public left?: Node
	public right?: Node
	public operator?: Node

	constructor(start: number, end: number) {
		super(start, end, NodeType.BinaryExpression)
	}

	public setLeft(left?: Node): left is Node {
		return this.setNode(left, undefined, node => (this.left = node))
	}

	public getLeft(): Node | undefined {
		return this.left
	}

	public setRight(right?: Node): right is Node {
		return this.setNode(right, undefined, node => (this.right = node))
	}

	public getRight(): Node | undefined {
		return this.right
	}

	public setOperator(value?: Node): value is Node {
		return this.setNode(value, undefined, node => (this.operator = node))
	}

	public getOperator(): Node | undefined {
		return this.operator
	}
}

export class Operator extends Node {
	constructor(start: number, end: number) {
		super(start, end, NodeType.Operator)
	}
}

export class Term extends Node {
	public operator?: Node
	public expression?: Node

	constructor(start: number, end: number) {
		super(start, end, NodeType.Term)
	}

	public setOperator(value?: Node): value is Node {
		return this.setNode(value, undefined, node => (this.operator = node))
	}

	public getOperator(): Node | undefined {
		return this.operator
	}

	public setExpression(value?: Node): value is Node {
		return this.setNode(value, undefined, node => (this.expression = node))
	}

	public getExpression(): Node | undefined {
		return this.expression
	}
}

export class Invocation extends Node {
	private arguments?: Nodelist

	constructor(start: number, end: number) {
		super(start, end, NodeType.Invocation)
	}

	public getArguments(): Nodelist {
		if (!this.arguments) {
			this.arguments = new Nodelist(this)
		}
		return this.arguments
	}
}

export class Function extends Invocation {
	public identifier?: Identifier

	constructor(start: number, end: number) {
		super(start, end)
	}

	public get type(): NodeType {
		return NodeType.Function
	}

	public setIdentifier(node?: Identifier): node is Identifier {
		return this.setNode(node, 0, node => {
			this.identifier = node
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
	public opacity?: Node

	static test(node?: Node): node is ColorFunction {
		return node?.type === NodeType.ColorFunction
	}

	constructor(start: number, end: number) {
		super(start, end)
	}

	public get type(): NodeType {
		return NodeType.ColorFunction
	}

	public setOpacity(node?: Node): node is Node {
		return this.setNode(node, 0, node => {
			this.opacity = node
			this.updateRange(node)
		})
	}

	public getOpacity() {
		return this.opacity
	}
}

export class FunctionArgument extends Node {
	public identifier?: Node
	public value?: Node

	constructor(start: number, end: number) {
		super(start, end, NodeType.FunctionArgument)
	}

	public setIdentifier(node?: Identifier): node is Identifier {
		return this.setNode(node, 0, node => (this.identifier = node))
	}

	public getIdentifier(): Node | undefined {
		return this.identifier
	}

	public getName(): string {
		return this.identifier?.text ?? ""
	}

	public setValue(node?: Node): node is Node {
		return this.setNode(node, 0, node => (this.value = node))
	}

	public getValue(): Node | undefined {
		return this.value
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
	constructor(start: number, end: number) {
		super(start, end, NodeType.HexColorValue)
	}
}
