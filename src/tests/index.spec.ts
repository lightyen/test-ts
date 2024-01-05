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
	[@media (min-height: 400px)]:(flex)
	[content: '[' ] grid-col-[& [cmdk-group-heading]] vov-[ data ]/[ yoc=k ] text-[color(srgb 1 1 1)]
	sm:hover:text-gb
	(sm:hover: just:):quqo-100
		`
	const p = new Parser(new Scanner(source))
	const program = p.parse(source, p.parseTwProgram, (start, end) => source.slice(start, end))
	if (!program) {
		return
	}
	for (const node of program.children) {
		if (nodes.isTwNormalVariantSpan(node)) {
			console.log(`node ${node.typeText}: [${node.start} ${node.end}]`, node.text)
		}
	}
})
