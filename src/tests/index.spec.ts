import { ColorFunction, isColorFunction, isHexColorValue, isNamedColorValue } from "../parser/nodes"
import { Parser } from "../parser/parser"
import { Scanner } from "../parser/scanner"

test("parser", () => {
	const source = "hsl(160 42% 30% 123 / .3 ) , #33333366 ,color(rec2020 1 1 1/ 4), chocolate"
	// const source = "rgb(32 18% 55% / 12%)"
	const p = new Parser(new Scanner(source))
	const n = p.parse(source, p.parseValue, (start, end) => source.slice(start, end))
	for (const c of n?.getChildren() ?? []) {
		console.log(`[${c.start} ${c.end}]`, c.text)
		for (const node of c?.getChildren() ?? []) {
			if (isColorFunction(node)) {
				console.log(node.channels)
				console.log(node.a)
			} else if (isHexColorValue(node)) {
				console.log(node.channels)
				console.log(node.a)
			} else if (isNamedColorValue(node)) {
				console.log(node.channels)
				console.log(node.a)
			}
		}
	}
})
