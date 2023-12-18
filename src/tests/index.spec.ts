import { ColorFunction } from "../parser/nodes"
import { Parser } from "../parser/parser"
import { Scanner } from "../parser/scanner"

test("parser", () => {
	// const source = "hsl(160 42 30% / .3 )"
	const source = "rgb(32 ,18%,55, 12%)"
	const p = new Parser(new Scanner(source))
	const n = p.parse(source, p.parseValue, (start, end) => source.slice(start, end))
	if (n?.children) {
		for (const c of n.children) {
			if (c.children) {
				for (const term of c.children) {
					if (ColorFunction.test(term)) {
						const fnName = term.getName()
						console.log("fnName =", fnName)

						console.log(term.r)
						console.log(term.g)
						console.log(term.b)
						console.log(term.a)
					}
				}
			}
		}
	}
})
