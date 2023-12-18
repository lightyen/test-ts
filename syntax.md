

<Expr> := <BinaryExpr> [, <BinaryExpr>]
<BinaryExpr> := <Term> [<op> <Term>]

<TermExpr> := <ident> | <uri> | <function> | ...
<FunctionArguments> := <Expr>

///

<css-value> := <value> ;?

<value> := <expr> [, <expr>]

<expr> := <term-expr> [ <term-expr>]

<term-expr> := <color-function> | <function> | <parentheses> | <hex-color> | <operator> | <dimension> | <number> | <named-color> | <ident> | <any>

<functionArgs> := <value>