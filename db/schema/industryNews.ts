import { sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const industryNewsSources = pgTable(
  'industry_news_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    homepageUrl: text('homepage_url').notNull(),
    feedUrl: text('feed_url'),
    sourceTier: text('source_tier').notNull().default('tier_1'),
    active: boolean('active').notNull().default(true),
    defaultRoleTargets: jsonb('default_role_targets')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    homepageUrlIdx: uniqueIndex('industry_news_sources_homepage_url_idx').on(table.homepageUrl),
  })
)

export const industryNewsItems = pgTable(
  'industry_news_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id').references(() => industryNewsSources.id, { onDelete: 'set null' }),
    sourceName: text('source_name').notNull(),
    sourceUrl: text('source_url').notNull(),
    articleUrl: text('article_url').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    thumbnailUrl: text('thumbnail_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    category: text('category').notNull().default('breaking_news'),
    priority: text('priority').notNull().default('medium'),
    roleTargets: jsonb('role_targets')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    tags: jsonb('tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    whyItMatters: text('why_it_matters').notNull().default(''),
    actionLabel: text('action_label'),
    isWisherRelevant: boolean('is_wisher_relevant').notNull().default(false),
    isAHAWCRelevant: boolean('is_ahawc_relevant').notNull().default(false),
    isMarylandRelevant: boolean('is_maryland_relevant').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    articleUrlIdx: uniqueIndex('industry_news_items_article_url_idx').on(table.articleUrl),
  })
)
