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
	const source = "hsl(160 42% 30% 123 / .3 ) , #33333366 ,color(rec2020 1 1 1/ 4), chocolate transparent"
	const p = new Parser(new Scanner(source))
	const n = p.parse(source, p.parseValue, (start, end) => source.slice(start, end))
	for (const c of n?.getChildren() ?? []) {
		console.log(`[${c.start} ${c.end}]`, c.text)
		for (const node of c?.getChildren() ?? []) {
			if (isColorFunction(node)) {
				console.log(node.name, node.space, node.channels, node.a)
			} else if (isHexColorValue(node) || isNamedColorValue(node)) {
				console.log(node.channels, node.a)
			} else if (isKeywordColorValue(node)) {
				console.log(node.typeText, node.text)
			}
		}
	}
})
