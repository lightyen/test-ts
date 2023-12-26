<css-value> := <value> ;?

<value> := <expr> [, <expr>]

<expr> := <term-expr> [ <term-expr>]

<term-expr> := <color-function> | <function> | <parentheses> | <hex-color> | <operator> | <dimension> | <number> | <named-color> | <ident> | <any>

<functionArgs> := <value>

- *classname*

   ```tw
   aaa
   aaa-bbb
   aaa-bbb/modifier
   ```

- *arbitrary-classname*

   ```tw
   aaa-[value]
   aaa-[value]/modifier
   ```

- *arbitrary-property*

   ```tw
   [aaa: value]
   ```

- *simple-variant*

   ```tw
   aaa-bbb:
   aaa-bbb/modifier:
   ```

- *arbitrary-variant*

   ```tw
   aaa-[value]:
   aaa-[value]/modifier:
   ```

- *arbitrary-selector*

   ```tw
   [.bbb, &:hover]:
   ```
