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

export class Marker {
	constructor(
		readonly node: Node,
		readonly rule: Rule,
		readonly level: Level,
		readonly message = rule.message,
		readonly start = node.start,
		readonly end = node.end,
	) {}

	public getLength(): number {
		return this.end - this.start
	}
}

export class IssueType implements Rule {
	id: string
	message: string
	constructor(id: string, message: string) {
		this.id = id
		this.message = message
	}
}

export const ParseError = {
	TermExpected: new IssueType("termexpected", "term expected"),
	ExpressionExpected: new IssueType("expressionexpected", "expression expected"),
	RightParenthesisExpected: new IssueType("rparentexpected", ") expected"),
	RightBracketExpected: new IssueType("rbracketexpected", "] expected"),
	RightCurlyExpected: new IssueType("rcurlyexpected", "} expected"),
}
