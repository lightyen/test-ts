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
	public parent: Node | null
	public children: Node[] | undefined
	public stringProvider: StringProvider | undefined

	constructor(start: number = -1, end: number = -1, nodeType?: NodeType) {
		this.parent = null
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
		return this.nodeType || NodeType.Undefined
	}

	private getStringProvider(): StringProvider {
		let node: Node | null = this
		while (node && !node.stringProvider) {
			node = node.parent
		}
		return node?.stringProvider ?? (() => "unknown")
	}

	public get length(): number {
		const l = this.end - this.start
		return l < 0 ? 0 : l
	}

	public toString(): string {
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

	public attachTo(parent: Node, index: number = -1): Node {
		parent.adoptChild(this, index)
		return this
	}

	public setNode(field: VVV<this, Node>, node: Node | null, index: number = -1): boolean {
		if (node) {
			node.attachTo(this, index)
			this[field] = node
			return true
		}
		return false
	}
}

type VVV<T extends object, V> = {
	[K in keyof T]: T[K] extends V ? K : never
}[keyof T]

export class Nodelist extends Node {
	constructor(parent: Node, index: number = -1) {
		super()
		this.attachTo(parent, index)
	}
}

// function createNode<T>(ctor: NodeConstructor<T>): T {
// 	return new ctor(this.token.offset, this.token.len)
// }

export class Identifier extends Node {
	public isCustomProperty = false

	constructor(offset: number, length: number) {
		super(offset, length)
	}

	public get type() {
		return NodeType.Identifier
	}
}

export class Invocation extends Node {
	private arguments?: Nodelist

	constructor(offset: number, length: number) {
		super(offset, length)
	}

	public get type() {
		return NodeType.Invocation
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

	constructor(offset: number, length: number) {
		super(offset, length)
	}

	public get type(): NodeType {
		return NodeType.Function
	}

	public setIdentifier(node: Identifier | null): node is Identifier {
		return this.setNode("identifier", node, 0)
	}

	public getIdentifier() {
		return this.identifier
	}

	public getName(): string {
		return this.identifier?.toString() ?? ""
	}
}
