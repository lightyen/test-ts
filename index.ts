import { type Token, ExprScanner } from "./scanner"

const tests = [
	"rgb(1,   22,   3 )",
	"rgb(1 2 3)",
	"rgb(1, 2, 3, 0.1)",
	"rgb(1 2 3 / 0.1)",
	"currentColor",
	"red",
	"hsl(160 42% 30%)",
	"color(display-p3 1 2 3 / 0.1)",
]

const others = [
	"none",
	"rgb(1, 2 3)",
	"rgb(1 2 3 0.1)",
	"rgb(1, 2, 3 /0.1)",
	"hsl(160 42 30%)",
	"var(--color)",
	"url(data:image/png;base64,iRxVB0) url(star.svg)",
	"url(data:image/png;base64,iRxVB0\\) url(star.svg)",
	"max(2, 3)",
]

for (const v of tests) {
	const s = new ExprScanner(v)

	let i = 0
	for (const t of s) {
		console.log(i++, t.toString())
	}
}

for (const v of others) {
	const s = new ExprScanner(v)
	console.log(Array.from(s).map(s => s.toString()))
}
