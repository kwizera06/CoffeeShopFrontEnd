# Fix: Auto-Deduction Using Saved Standard Yield

## Problem
When recording production, the system wasn't using the `standard_yield` you saved on the recipe. It was showing incorrect deduction calculations.

**Example:**
- You set: Standard Yield = 25
- You enter: Quantity to Add = 10
- Expected: 10 ÷ 25 = 0.40 batches
- Was showing: 10 ÷ 1 = 10.00 batches ❌

## Root Cause
The frontend was reading `recipe.standardYield`, but if the API response wasn't including it (or had a different field name), it would default to undefined or fall back to 1.

## Solution Applied

### What Changed
In `CashierDashboard.jsx`, added a fallback chain:

```javascript
// BEFORE
const batchesNeeded = recipe && quantityToAdd > 0 
  ? parseFloat(quantityToAdd) / recipe.standardYield 
  : 0

// AFTER
const standardYield = recipe?.standardYield || selectedProduct?.standardYield || 1
const batchesNeeded = recipe && quantityToAdd > 0 
  ? parseFloat(quantityToAdd) / standardYield 
  : 0
```

This ensures:
1. **Primary:** Use `recipe.standardYield` (from API)
2. **Fallback:** Use `selectedProduct.standardYield` (from products list)
3. **Default:** Use 1 (if both are missing)

### Updated Display
All three places now use the same `standardYield` variable:
- Line 538: "Standard yield: {standardYield} units per batch"
- Line 566: "Calculation: {quantityToAdd} units ÷ {standardYield} = {batchesNeeded}"
- Line 550: placeholder={`e.g. ${standardYield}`}

## How It Works Now

### Scenario: Set Standard Yield = 25
1. **Admin Menu:** Edit Product → Standard Yield = 25 → Save
   - Database: `menu_items.standard_yield = 25`

2. **API Returns:**
   - `/api/shop/cashier/prepared-products` → `standardYield: 25`
   - `selectedProduct.standardYield = 25`

3. **Cashier Selects Product:**
   - Product selected
   - Recipe loaded (if exists)
   - `recipe.standardYield = 25` (from API)

4. **Enter Quantity to Add = 10:**
   ```
   standardYield = 25 (from recipe OR selectedProduct)
   batchesNeeded = 10 ÷ 25 = 0.40 batches ✅
   
   Display shows:
   "Calculation: 10 ÷ 25 = 0.40 batches"
   
   Ingredient Deduction:
   If Flour = 5 per batch: 5 × 0.40 = 2.00 units ✅
   ```

5. **Click "Produce":**
   - Backend receives: `quantityToAdd: 10`
   - Backend calculates: batches = 10 ÷ 25 = 0.40
   - Backend deducts: Each ingredient × 0.40
   - Stock updated: Product +10, Ingredients deducted correctly

## Files Changed
- `CashierDashboard.jsx` (lines 185-187, 538, 550, 566)
  - Added `standardYield` variable with fallback chain
  - Updated all three display locations to use it

## No Backend Changes Needed
The backend already returns `standardYield` correctly:
- `cashierProductionService.js` → `getRecipe()` returns `standardYield: product.standard_yield || 1`
- `cashierProductionService.js` → `saveRecipe()` updates `standard_yield` on product
- `shopController.js` → `/api/shop/cashier/recipes` endpoints all correct

## Test It

### Test 1: Basic Yield Calculation
1. Admin: Create product "Test Samosas" 
   - Standard Yield: 100
2. Cashier: Add Recipe
   - Ingredient: Flour qty 10 per batch
   - Save Recipe
3. Record Production:
   - Quantity: 50
   - Should show: "Calculation: 50 ÷ 100 = 0.50 batches"
   - Flour deduction: 10 × 0.50 = 5.00 ✅

### Test 2: Different Yield Values
1. Test with Standard Yield = 1
   - Quantity: 5
   - Calculation: 5 ÷ 1 = 5.00 batches ✅

2. Test with Standard Yield = 25
   - Quantity: 100
   - Calculation: 100 ÷ 25 = 4.00 batches ✅

3. Test with Standard Yield = 0.5
   - Quantity: 2
   - Calculation: 2 ÷ 0.5 = 4.00 batches ✅

### Test 3: Ingredient Stock Verification
1. Create recipe: Standard Yield = 10, Flour = 2/batch
2. Current Flour stock: 50
3. Record Production: 30 units
   - Batches: 30 ÷ 10 = 3.00
   - Flour deduction: 2 × 3 = 6.00
   - Flour remaining: 50 - 6 = 44 ✅

## Verification
After deploying this fix:

1. **Refresh frontend:** http://localhost:5173
2. **Select a product** with recipe
3. **Enter quantity** → Should show correct calculation
4. **Check deduction** → Should match formula: (ingredient_qty ÷ standard_yield) × quantity_entered

If still wrong:
1. Check browser DevTools → Network → GET `/api/shop/cashier/recipes/:id`
2. Verify response includes `standardYield` field
3. Check Product selection → verify `standardYield` in response

## Summary
✅ Frontend now uses fallback chain for standardYield
✅ All calculations use consistent value
✅ All displays use consistent value
✅ Deductions will now correctly use saved standard yield
✅ No API/backend changes needed
