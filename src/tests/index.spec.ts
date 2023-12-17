import { ColorFunction } from "../parser/nodes"
import { Parser } from "../parser/parser"
import { Scanner } from "../parser/scanner"

test("scanner", () => {
	const source = "hsl ()"
	for (const t of new Scanner(source)) {
		// console.log(t.typeString(), `"${t.getText(source)}"`)
	}
})

test("parser", () => {
	const source = "hsl(160 42 30% / .3 )"
	const p = new Parser(new Scanner(source))
	const n = p.parse(source, p.parseTerm, (start, end) => source.slice(start, end))
	const v = n?.children?.at(0)
	if (ColorFunction.test(v)) {
		for (const n of v.getChildren()) {
			console.log(n.typeText, n.start, n.end, n.text)
		}
	} else {
		console.log(v?.typeText)
	}
})
