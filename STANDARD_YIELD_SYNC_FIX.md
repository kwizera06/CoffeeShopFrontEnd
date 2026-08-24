# Standard Yield Synchronization Fix

## Problem
When you set **Standard Yield = 25** on a product in the Menu (Admin), but opened the recipe creation modal in the Cashier production tab, it showed **Standard Yield = 1** instead of **25**.

### Images Showed
- **Image 1 (Menu):** Product "Vegetable Sambusa" with Standard Yield = 25
- **Image 2 (Recipe Modal):** Same product showing Standard Yield = 1 when creating recipe

This caused a **mismatch** between what was configured and what the cashier saw.

## Root Cause
In `CashierDashboard.jsx`, when opening the recipe creation modal, the code was:

```javascript
setRecipeForm({
  standardYield: '1',  // ❌ HARDCODED to 1
  ingredients: []
})
```

It wasn't reading the `selectedProduct.standardYield` value from the API response.

## Solution Applied
Changed the code to read the product's standard_yield:

```javascript
const productStandardYield = selectedProduct?.standardYield || 1
setRecipeForm({
  standardYield: String(productStandardYield),  // ✅ Uses product's yield
  ingredients: []
})
```

## How It Works Now

### Step 1: Admin Sets Standard Yield
1. Go to **Admin** → **Menu** → Edit Product
2. Set **Standard Yield (Batch Size): 25**
3. Click **Save Changes**
4. Product is saved with `standard_yield = 25`

### Step 2: Product Gets Loaded with Correct Yield
When API returns the product, it includes:
```json
{
  "id": "...",
  "name": "Vegetable Sambusa",
  "standardYield": 25,  // From database
  "hasRecipe": false
}
```

### Step 3: Recipe Modal Shows Correct Yield
When cashier clicks "Create Recipe" (no recipe exists yet):

**Before Fix:**
```
Standard Yield: 1  ❌ Wrong
```

**After Fix:**
```
Standard Yield: 25  ✅ Correct
```

### Step 4: Recipe Saved with Correct Yield
When you save the recipe:
- The `handleSaveRecipe` function sends: `standardYield: 25`
- Backend updates the product: `standard_yield = 25`
- Next time you edit, it still shows `25`

## Sync Flow

```
Menu Edit (Admin)
    ↓
Product saved with standard_yield = 25
    ↓
API returns product with standardYield: 25
    ↓
Cashier selects product
    ↓
Recipe modal opens with standardYield = 25
    ↓
Cashier adds ingredients
    ↓
Save recipe (standard_yield stays 25)
    ↓
Next production uses correct 25 yield for auto-deduction
```

## Verification

### Test 1: Create New Recipe
1. Admin: Edit a product → Set Standard Yield = 50 → Save
2. Cashier: Record Production → Search product → Click to select
3. Should see: **Recipe modal opens with Standard Yield = 50**
4. Add ingredients → Save Recipe
5. Recipe saved with yield = 50 ✅

### Test 2: Edit Existing Recipe
1. Cashier: Select a product with existing recipe
2. Click "Edit Recipe" button
3. Should show: **Current Standard Yield from product** (e.g., 25)
4. Modify ingredients/yield as needed
5. Save → Changes persist ✅

### Test 3: Auto-Deduction Uses Correct Yield
1. Product: Standard Yield = 25, Ingredient: Flour qty = 5
2. Cashier: Enter quantity = 50
3. Should calculate:
   - Batches: 50 ÷ 25 = 2.00
   - Flour deduction: 5 × 2 = 10 ✅

## Files Changed
- `CoffeeShop_Frontend/src/pages/shop/CashierDashboard.jsx` (line 171-174)
  - Changed hardcoded `standardYield: '1'` to use `selectedProduct.standardYield`

## Backend Support
The backend already handles this correctly:
- `cashierProductionService.js`: `getRecipe()` returns `standardYield: product.standard_yield`
- `cashierProductionService.js`: `saveRecipe()` updates product's `standard_yield`
- `shopController.js`: API endpoints fully implemented

## No Additional Changes Needed
- ✅ Frontend: Fixed
- ✅ Backend: Already correct
- ✅ Database: Columns exist (`standard_yield`, `is_recipe`)

## Next Steps
1. Test the three test cases above
2. Confirm standard yield values match between Menu and Recipe modal
3. Verify auto-deduction calculations use the correct yield
