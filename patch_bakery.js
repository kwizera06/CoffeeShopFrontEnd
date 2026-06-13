const fs = require('fs');
let src = fs.readFileSync('src/pages/shop/Owner.jsx', 'utf8');

// Fix 1: Replace create-only block with create/update block
const CR = '\r\n';
const SP = '                        '; // 24 spaces
const SP2 = '                          '; // 26 spaces
const SP3 = '                            '; // 28 spaces

const oldCreate = [
  `${SP}// 1. Create the Main Recipe Item`,
  `${SP}const item = await api('/api/shop/menu', { `,
  `${SP2}method: 'POST', `,
  `${SP2}body: JSON.stringify({`,
  `${SP3}...menuForm, `,
  `${SP3}price: Number(menuForm.price || 0),`,
  `${SP3}recipe_reference_yield: Number(menuForm.recipe_reference_yield || 1),`,
  `${SP3}category: 'Bakery', `,
  `${SP3}is_recipe: true, `,
  `${SP3}is_bakery: true, `,
  `${SP3}category_group: mainItemName`,
  `${SP2}}) `,
  `${SP}});`,
].join(CR);

const newCreate = [
  `${SP}// 1. Create or Update the Main Recipe Item`,
  `${SP}const isEdit = !!menuForm.id;`,
  `${SP}const itemPayload = {`,
  `${SP2}...menuForm,`,
  `${SP2}price: Number(menuForm.price || 0),`,
  `${SP2}recipe_reference_yield: Number(menuForm.recipe_reference_yield || 1),`,
  `${SP2}category: 'Bakery',`,
  `${SP2}is_recipe: true,`,
  `${SP2}is_bakery: true,`,
  `${SP2}category_group: mainItemName`,
  `${SP}};`,
  `${SP}let item;`,
  `${SP}if (isEdit) {`,
  `${SP2}item = await api('/api/shop/menu/' + menuForm.id, { method: 'PUT', body: JSON.stringify(itemPayload) });`,
  `${SP}} else {`,
  `${SP2}item = await api('/api/shop/menu', { method: 'POST', body: JSON.stringify(itemPayload) });`,
  `${SP}}`,
].join(CR);

if (!src.includes(oldCreate)) {
  console.error('FIX1: NOT FOUND. Checking first line...');
  const firstLine = `${SP}// 1. Create the Main Recipe Item`;
  console.error('First line present?', src.includes(firstLine));
  process.exit(1);
}
src = src.replace(oldCreate, newCreate);
console.log('FIX1: done');

// Fix 2: Replace item.id with safe fallback
const SP4 = '                                '; // 32 spaces
const oldId = `${SP4}menu_item_id: item.id,`;
const newId  = `${SP4}menu_item_id: (item && item.id) ? item.id : menuForm.id,`;
if (!src.includes(oldId)) { console.error('FIX2: NOT FOUND'); process.exit(1); }
src = src.replace(oldId, newId);
console.log('FIX2: done');

// Fix 3: Skip variants on edit
const oldVariants = `${SP}// 2. Create Variants${CR}${SP}if (menuForm.variantOutputs && menuForm.variantOutputs.length > 0) {`;
const newVariants  = `${SP}// 2. Create Variants (skip on edit)${CR}${SP}if (!isEdit && menuForm.variantOutputs && menuForm.variantOutputs.length > 0) {`;
if (!src.includes(oldVariants)) { console.error('FIX3: NOT FOUND'); process.exit(1); }
src = src.replace(oldVariants, newVariants);
console.log('FIX3: done');

// Fix 4: Update success message
const oldMsg = "alert(`\uD83C\uDF1F Recipe \"${mainItemName}\" and its variants created!`);";
const newMsg = "alert(isEdit ? `\u2705 Item \"${mainItemName}\" updated!` : `\uD83C\uDF1F Recipe \"${mainItemName}\" and its variants created!`);";
if (!src.includes(oldMsg)) { console.error('FIX4: NOT FOUND'); process.exit(1); }
src = src.replace(oldMsg, newMsg);
console.log('FIX4: done');

fs.writeFileSync('src/pages/shop/Owner.jsx', src, 'utf8');
console.log('All fixes applied successfully!');
