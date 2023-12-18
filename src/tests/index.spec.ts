import { ColorFunction } from "../parser/nodes"
import { Parser } from "../parser/parser"
import { Scanner } from "../parser/scanner"

test("parser", () => {
	const source = "hsl(160 42 30% / .3 )"
	const p = new Parser(new Scanner(source))
	const n = p.parse(source, p.parseValue, (start, end) => source.slice(start, end))
	if (n?.children) {
		for (const c of n.children) {
			if (c.children) {
				for (const term of c.children) {
					if (ColorFunction.test(term)) {
						const fnName = term.getName()
						console.log("fnName =", fnName)

						const args = term.getArguments()
						if (args) {
							console.log(args.typeText, args.start, args.end, args.text)
						}
					}
				}
			}
		}
	}
})
