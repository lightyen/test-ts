import { Node } from "./nodes"

export enum Level {
	Ignore = 1,
	Warning = 2,
	Error = 4,
}

export interface Rule {
	id: string
	message: string
}

export interface IMarker {
	getNode(): Node
	getMessage(): string
	getOffset(): number
	getLength(): number
	getRule(): Rule
	getLevel(): Level
}

export class Marker implements IMarker {
	constructor(
		readonly node: Node,
		readonly rule: Rule,
		readonly level: Level,
		readonly message = rule.message,
		readonly start = node.start,
		readonly end = node.end,
	) {}

	public getRule(): Rule {
		return this.rule
	}

	public getLevel(): Level {
		return this.level
	}

	public getOffset(): number {
		return this.start
	}

	public getEnd(): number {
		return this.end
	}

	public getLength(): number {
		return this.end - this.start
	}

	public getNode(): Node {
		return this.node
	}

	public getMessage(): string {
		return this.message
	}
}

export class CSSIssueType implements Rule {
	id: string
	message: string
	constructor(id: string, message: string) {
		this.id = id
		this.message = message
	}
}

export const ParseError = {
	TermExpected: new CSSIssueType("css-termexpected", "term expected"),
	ExpressionExpected: new CSSIssueType("css-expressionexpected", "expression expected"),
	RightParenthesisExpected: new CSSIssueType("css-rparentexpected", ") expected"),
}
