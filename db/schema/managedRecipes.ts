import { pgTable, text, jsonb, date, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
export const managedRecipes = pgTable('managed_recipes', {
  handle: text('handle').primaryKey(), title: text('title').notNull(),
  ingredients: jsonb('ingredients').$type<string[]>().notNull().default([]),
  steps: jsonb('steps').$type<string[]>().notNull().default([]),
  seasons: jsonb('seasons').$type<string[]>().notNull().default([]),
  availableFrom: date('available_from'), availableUntil: date('available_until'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  updatedBy: uuid('updated_by').references(() => users.id), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export const recipeSelections = pgTable('recipe_selections', {
  scope: text('scope').primaryKey(), handle: text('handle').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
