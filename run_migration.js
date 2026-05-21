
import { createClient } from '@supabase/supabase-js'

const url = 'https://cgmkqyveiihkjwvkagwn.supabase.co'
const key = 'sb_publishable_9dPnubYXAJ5irAn3jPewSg_To9bAobh'
const supabase = createClient(url, key)

async function migrate() {
  console.log('Starting migration...')
  
  // 1. Get all menu items in beverage categories
  const targetCategories = ['Soft Drinks', 'Beer & Alcohol', 'Wines', 'Soda & Water']
  const { data: menuItems, error: mError } = await supabase
    .from('menu_items')
    .select('*, recipe_items(*, ingredients(*))')
    .in('category', targetCategories)
  
  if (mError) {
    console.error('Error fetching menu items:', mError)
    return
  }

  console.log(`Found ${menuItems.length} potential items to migrate.`)

  for (const item of menuItems) {
    if (item.recipe_items && item.recipe_items.length === 1) {
      const ri = item.recipe_items[0]
      const ing = ri.ingredients
      
      console.log(`Migrating ${item.name}: Stock ${ing.stock_level}, Price ${ing.buying_price}`)
      
      const { error: uError } = await supabase
        .from('menu_items')
        .update({
          stock_level: ing.stock_level,
          buying_price: ing.buying_price,
          is_recipe: false
        })
        .eq('id', item.id)

      if (uError) {
        console.error(`Failed to update ${item.name}:`, uError)
        continue
      }

      await supabase.from('recipe_items').delete().eq('id', ri.id)
      console.log(`  -> Successfully migrated and unlinked recipe for ${item.name}`)
    } else if (item.recipe_items && item.recipe_items.length === 0) {
       await supabase.from('menu_items').update({ is_recipe: false }).eq('id', item.id)
    }
  }
  
  console.log('Migration complete!')
}

migrate()
