import {
	ColorFunction,
	isColorFunction,
	isHexColorValue,
	isKeywordColorValue,
	isNamedColorValue,
} from "../parser/nodes"
import { Parser } from "../parser/parser"
import { Scanner } from "../parser/scanner"

test("parser", () => {
	const source = "hsl(160 42% 30% 123 / .3 ), 重新 , #33333366 ,color(rec2020 1 1 1/ 4), chocolate transparent"
	const p = new Parser(new Scanner(source))
	const n = p.parse(source, p.parseValue, (start, end) => source.slice(start, end))
	for (const c of n?.getChildren() ?? []) {
		let isColor = false
		for (const node of c?.getChildren() ?? []) {
			if (isColorFunction(node)) {
				isColor = true
				console.log(node.name, node.space, node.channels, node.a)
			} else if (isHexColorValue(node) || isNamedColorValue(node)) {
				isColor = true
				console.log(node.channels, node.a)
			} else if (isKeywordColorValue(node)) {
				isColor = true
				console.log(node.typeText, node.text)
			}
		}
		if (!isColor) {
			console.log(`node ${c.typeText}: [${c.start} ${c.end}]`, c.text)
			console.log(c.getChildren())
		}
	}
})

test("tw", () => {
	const source = "test-sd -px-0.3 text-[color(srgb 1 1 1)]"
	const p = new Parser(new Scanner(source))
	const n = p.parse(source, p.parseValue, (start, end) => source.slice(start, end))
	for (const c of n?.getChildren() ?? []) {
		console.log(`node ${c.typeText}: [${c.start} ${c.end}]`, c.text)
		console.log(c.getChildren())
	}
})
