import * as nodes from "./nodes"

export function isFunction(node?: nodes.Node): node is nodes.Function {
	return node?.type === nodes.NodeType.Function
}

export function isCssExpression(node?: nodes.Node): node is nodes.CssExpression {
	return node?.type === nodes.NodeType.CssExpression
}

export function isCssValue(node?: nodes.Node): node is nodes.CssValue {
	return node?.type === nodes.NodeType.CssValue
}

export function isNumericValue(node?: nodes.Node): node is nodes.NumericValue {
	return node?.type === nodes.NodeType.NumericValue
}

export function isHexColorValue(node?: nodes.Node): node is nodes.HexColorValue {
	return node?.type === nodes.NodeType.HexColorValue
}

export function isColorFunction(node?: nodes.Node): node is nodes.ColorFunction {
	return node?.type === nodes.NodeType.ColorFunction
}

export function isNamedColorValue(node?: nodes.Node): node is nodes.NamedColorValue {
	return node?.type === nodes.NodeType.NamedColorValue
}

export function isKeywordColorValue(node?: nodes.Node): node is nodes.KeywordColorValue {
	return node?.type === nodes.NodeType.KeywordColorValue
}

export function isTwDecl(node?: nodes.Node): node is nodes.TwDecl {
	if (!node) {
		return false
	}
	return node.type === nodes.NodeType.TwDecl
}

export function isTwRaw(node?: nodes.Node): node is nodes.TwRaw {
	if (!node) {
		return false
	}
	return node.type === nodes.NodeType.TwRaw
}

export function isCssDecl(node?: nodes.Node): node is nodes.CssDecl {
	if (!node) {
		return false
	}
	return node.type === nodes.NodeType.CssDecl
}

export function isTwGroup(node?: nodes.Node): node is nodes.TwGroup {
	if (!node) {
		return false
	}
	return node.type === nodes.NodeType.TwGroup
}

export function isTwSpan(node?: nodes.Node): node is nodes.TwSpan {
	if (!node) {
		return false
	}
	return node.type === nodes.NodeType.TwSpan
}

export function isTwNormalVariantSpan(node?: nodes.Node): node is nodes.TwNormalVariantSpan {
	if (!node) {
		return false
	}
	if (!isTwSpan(node)) {
		return false
	}
	return node.variant?.type === nodes.NodeType.TwDecl
}

export function isTwGroupVariantSpan(node?: nodes.Node): node is nodes.TwGroupVariantSpan {
	if (!node) {
		return false
	}
	if (!isTwSpan(node)) {
		return false
	}
	return node.variant?.type === nodes.NodeType.TwGroup
}

export function isTwRawVariantSpan(node?: nodes.Node): node is nodes.TwRawVariantSpan {
	if (!node) {
		return false
	}
	if (!isTwSpan(node)) {
		return false
	}
	return node.variant?.type === nodes.NodeType.TwRaw
}
