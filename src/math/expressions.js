/** Safe arithmetic expression utilities. AST nodes are plain data, never executable code. */
const FUNCTIONS = Object.freeze({
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
  atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log,
  log: Math.log10, floor: Math.floor, ceil: Math.ceil, round: Math.round,
});

/** Evaluate an AST returned by parser.js for a numeric y. */
export function evaluateExpression(ast, y) {
  if (!Number.isFinite(y)) throw new RangeError('y debe ser finito');
  function visit(n) {
    let value;
    switch (n?.type) {
      case 'number': value = n.value; break;
      case 'variable': if (n.name !== 'y') throw new TypeError('Variable no permitida'); value = y; break;
      case 'unary': value = n.op === '-' ? -visit(n.arg) : visit(n.arg); break;
      case 'binary': {
        const a = visit(n.left), b = visit(n.right);
        if (n.op === '+') value = a + b;
        else if (n.op === '-') value = a - b;
        else if (n.op === '*') value = a * b;
        else if (n.op === '/') { if (b === 0) throw new RangeError('División por cero'); value = a / b; }
        else if (n.op === '^') value = a ** b;
        else throw new TypeError('Operador no permitido');
        break;
      }
      case 'call': {
        const fn = FUNCTIONS[n.name];
        if (!fn || n.args.length !== 1) throw new TypeError('Función no permitida');
        value = fn(visit(n.args[0])); break;
      }
      default: throw new TypeError('AST inválido');
    }
    if (!Number.isFinite(value)) throw new RangeError('La expresión produjo un valor no finito');
    return value;
  }
  return visit(ast);
}

/** Return a readable infix representation of an AST. */
export function expressionToString(ast) {
  switch (ast?.type) {
    case 'number': return String(ast.value);
    case 'variable': return ast.name;
    case 'unary': return `(${ast.op}${expressionToString(ast.arg)})`;
    case 'binary': return `(${expressionToString(ast.left)} ${ast.op} ${expressionToString(ast.right)})`;
    case 'call': return `${ast.name}(${ast.args.map(expressionToString).join(', ')})`;
    default: throw new TypeError('AST inválido');
  }
}

export const ALLOWED_FUNCTIONS = Object.freeze(Object.keys(FUNCTIONS));
