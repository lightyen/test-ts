import { readFileSync, writeFileSync } from "fs"
import * as nodes from "../parser/nodes"
import { Parser } from "../parser/parser"
import { Scanner, Scope, TokenType } from "../parser/scanner"
import { ParseError, Rule } from "../parser/errors"
import { expect, test } from "vitest"

function assertNode<Node extends nodes.Node, U extends Node | undefined>(
	source: string,
	parser: Parser,
	parseFunc: () => U,
) {
	const node = parser.parse(source, parseFunc)
	if (node) {
		expect(parser.accept(TokenType.EOF)).toBeTruthy()
	}
	return node
}

function assertError<Node extends nodes.Node, U extends Node | undefined>(
	text: string,
	parser: Parser,
	parseFunc: () => U,
	error: Rule,
): void {
	const node = parser.parse(text, parseFunc)
	expect(node).toBeTruthy()
	if (node) {
		let markers = nodes.collectParseError(node)
		expect(markers.length).toBeGreaterThan(0)
		if (markers.length > 0) {
			markers = markers.sort((a, b) => {
				return a.node.start - b.node.start
			})
			expect(markers[0].rule.id).toEqual(error.id)
		}
	}
}

test("test", () => {
	const parser = new Parser()
	print(assertNode("test-sd -px-0.3", parser, parser.parseTwProgram.bind(parser)))
})

test("color", () => {
	const parser = new Parser()
	parser.scope = Scope.CssValue
	const text =
		"hsl(160 42% 30% 123 / .3 ),  重新 , rgb(241, 243, 20, 0.24), #33333366 ,color(rec2020 1 1 1/ 4), chocolate transparent"
	const cssvalue = parser.parse(text, parser.parseCssValue, (a, b) => text.slice(a, b))
	if (!cssvalue) {
		return
	}
	for (const exprs of cssvalue.children) {
		let isColor = false
		for (const node of exprs.children) {
			if (nodes.isColorFunction(node)) {
				isColor = true
				console.log(node.text, node.name, node.space, node.channels, node.a)
			} else if (nodes.isHexColorValue(node) || nodes.isNamedColorValue(node)) {
				isColor = true
				console.log(node.text, node.channels, node.a)
			} else if (nodes.isKeywordColorValue(node)) {
				isColor = true
				console.log(node.typeText, node.text)
			}
		}
		if (!isColor) {
			console.log(`node ${exprs.typeText}: [${exprs.start} ${exprs.end}]`, exprs.text)
		}
	}
})

test("a", () => {
	const source = "& [cmdk-group-heading]"
	const p = new Parser()
	p.scope = Scope.CssValue
	const n = p.parse(source, p.parseCssDecl, (start, end) => source.slice(start, end))
	if (!n) {
		return
	}
	for (const c of n.children) {
		let isColor = false
		for (const node of c.children) {
			if (nodes.isColorFunction(node)) {
				isColor = true
				console.log(node.name, node.space, node.channels, node.a)
			} else if (nodes.isHexColorValue(node) || nodes.isNamedColorValue(node)) {
				isColor = true
				console.log(node.channels, node.a)
			} else if (nodes.isKeywordColorValue(node)) {
				isColor = true
				console.log(node.typeText, node.text)
			}
		}
		if (!isColor) {
			console.log(`node ${c.typeText}: [${c.start} ${c.end}]`, c.text)
			console.log(c.children)
		}
	}
})

test("tw", () => {
	const parser = new Parser()
	const r = assertNode(
		`opacity-50 group-hover/sidebar:opacity-75 group-hover/navitem:-bg-black/75
	test-sd -px-0.3 whio/dsd/xom sdo/[0.3]
	{:where(&) :is(h1, h2, h3, h4)}:
	[#wrapper > * > div > .text]:
	[@media (min-height: 400px)]:flex
	[content: 'v[' ] grid-col-[& [cmdk-group-heading]] vov-[ data ]/[ yoc=k ] text-[color(srgb 1 1 1)]
	sm:hover:text-gb
	(sm:hover: just:vv):quqo-100
		`,
		parser,
		parser.parseTwProgram,
	)
	print(r)

	assertNode("[@media screen, projection]:text-black", parser, parser.parseTwProgram)
	assertNode("[@media screen and (max-width: 400px)]:[@-ms-viewport]:[width: 320px]", parser, parser.parseTwProgram)
	assertNode('[input[type="submit"]]:text-black', parser, parser.parseTwProgram)
})

test("issue", () => {
	const parser = new Parser()
	assertError("(sm:hover: just:vv:quqo-100", parser, parser.parseTwProgram, ParseError.RightParenthesisExpected)
})

test("file", () => {
	const data = readFileSync("test", "utf8")
	const source = data
	const p = new Parser()
	const program = p.parse(source, p.parseTwProgram, (start, end) => source.slice(start, end))
	print(program)
})

test("selector", () => {
	const data = readFileSync("selector", "utf8")
	const source = data
	const p = new Parser()
	const program = p.parse(source, p.parseTwProgram, (start, end) => source.slice(start, end))
	print(program)
})

test("url", function () {
	const parser = new Parser()
	parser.scope = Scope.CssValue
	assertNode("url(//yourdomain/yourpath.png)", parser, parser.parseCssFunction.bind(parser))
	assertNode("url('http://msft.com')", parser, parser.parseCssFunction.bind(parser))
	assertNode('url("http://msft.com")', parser, parser.parseCssFunction.bind(parser))
	assertNode('url( "http://msft.com")', parser, parser.parseCssFunction.bind(parser))
	assertNode('url(\t"http://msft.com")', parser, parser.parseCssFunction.bind(parser))
	assertNode('url(\n"http://msft.com")', parser, parser.parseCssFunction.bind(parser))
	assertNode('url("http://msft.com"\n)', parser, parser.parseCssFunction.bind(parser))
	assertNode('url("")', parser, parser.parseCssFunction.bind(parser))
	assertNode('uRL("")', parser, parser.parseCssFunction.bind(parser))
	assertNode('URL("")', parser, parser.parseCssFunction.bind(parser))
	assertNode("url(http://msft.com)", parser, parser.parseCssFunction.bind(parser))
	assertNode("url()", parser, parser.parseCssFunction.bind(parser))
	assertNode("url('http://msft.com\n)", parser, parser.parseCssFunction.bind(parser))
	assertError(
		'url("http://msft.com"',
		parser,
		parser.parseCssFunction.bind(parser),
		ParseError.RightParenthesisExpected,
	)
	assertError(
		"url(http://msft.com')",
		parser,
		parser.parseCssFunction.bind(parser),
		ParseError.RightParenthesisExpected,
	)
})

test("list", () => {
	const data = readFileSync("list", "utf8")
	const source = data
	const p = new Parser()
	p.parse(source, p.parseTwProgram, (start, end) => source.slice(start, end))
})

function print(node?: nodes.Node, prefix = "") {
	if (!node) {
		return
	}

	console.log(`${prefix}${node.typeText}(${node.parent?.typeText ?? "null"}): [${node.start} ${node.end}]`, node.text)

	if (nodes.isFunction(node)) {
		print(node.identifier, "[css-func]")
		for (const v of node.children) {
			print(v, "[css-func]")
		}
		return
	}

	if (nodes.isTwDecl(node)) {
		print(node.identifier, "[tw]")
		print(node.value, "[tw]")
		print(node.modifier, "[tw]")
		return
	}

	if (nodes.isCssDecl(node)) {
		print(node.id, "[css]")
		print(node.value, "[css]")
		return
	}

	if (nodes.isTwSpan(node)) {
		print(node.variant, "[variant]")
		if (node.expr) {
			print(node.expr, "[variant]")
		} else {
			console.log("[variant] null")
		}
		return
	}

	for (const v of node.children) {
		print(v, prefix)
	}
}
