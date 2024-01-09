import { readFileSync, writeFileSync } from "fs"
import * as nodes from "../parser/nodes"
import { Parser } from "../parser/parser"
import { Scanner, ScannerScope } from "../parser/scanner"

test("css", () => {
	const source = "hsl(160 42% 30% 123 / .3 ), // 重新 , #33333366 ,color(rec2020 1 1 1/ 4), chocolate transparent"
	const p = new Parser(new Scanner(source, ScannerScope.Css))
	const n = p.parse(source, p.parseCssValue, (start, end) => source.slice(start, end))
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

test("a", () => {
	const source = "& [cmdk-group-heading]"
	const p = new Parser(new Scanner(source, ScannerScope.Css))
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
	const source = `
	test-sd -px-0.3 whio/dsd/xom sdo/[0.3]
	[:where(&) :is(h1, h2, h3, h4)]
	[#wrapper > * > div > .text]:
	[@media (min-height: 400px)]:flex
	[content: 'v[' ] grid-col-[& [cmdk-group-heading]] vov-[ data ]/[ yoc=k ] text-[color(srgb 1 1 1)]
	sm:hover:text-gb
	(sm:hover: just:vv):quqo-100
		`
	const p = new Parser(new Scanner(source))
	const program = p.parse(source, p.parseTwProgram, (start, end) => source.slice(start, end))
	print(program)
})

test("file", () => {
	const data = readFileSync("test", "utf8")
	const source = data
	const p = new Parser(new Scanner(source))
	const program = p.parse(source, p.parseTwProgram, (start, end) => source.slice(start, end))
	print(program)
})

test("list", () => {
	const data = readFileSync("list", "utf8")
	const source = data
	const p = new Parser(new Scanner(source))
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
