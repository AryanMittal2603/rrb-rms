export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function content(parent, value) {
  if (value === undefined || value === null) return;
  parent.appendChild(typeof value === 'string' ? document.createTextNode(value) : value);
}

export function emit(node) {
  node.dispatchEvent(new Event('input', { bubbles: true }));
  node.dispatchEvent(new Event('change', { bubbles: true }));
}

let counter = 0;
export function uid(prefix) {
  counter++;
  return prefix + '-' + counter;
}
