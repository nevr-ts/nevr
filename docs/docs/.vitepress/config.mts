import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Nevr",
  description: "Nevr write boilerplate again — The Framework Agnostic API Builder",
  head: [
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    ['meta', { property: 'og:title', content: 'Nevr — Nevr write boilerplate again' }],
    ['meta', { property: 'og:description', content: 'Entity-first, type-safe API framework. Define once, ship everywhere.' }],
  ],
  themeConfig: {
    logo: '/nevr_pp.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/get-started/introduction' },
      { text: 'API', link: '/api/core' }
    ],
    sidebar: [
      {
        text: 'Get Started',
        items: [
          { text: 'Introduction', link: '/get-started/introduction' },
          { text: 'Comparison', link: '/get-started/comparison' },
          { text: 'Installation', link: '/get-started/installation' },
          { text: 'Basic Usage', link: '/get-started/basic-usage' }
        ]
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Philosophy', link: '/concepts/philosophy' },
          { text: 'Entities', link: '/concepts/entity' },
          { text: 'Drivers', link: '/concepts/driver' },
          { text: 'Adapters', link: '/concepts/adapter' },
          { text: 'Plugins', link: '/concepts/plugin' },
          { text: 'Routes', link: '/concepts/route' },
          { text: 'Type Safety', link: '/concepts/type-safety' }
        ]
      },
      {
        text: 'Entity',
        items: [
          { text: 'Defining Entities', link: '/entity/define-entity' },
          { text: 'Fields', link: '/entity/fields' },
          { text: 'Validation', link: '/entity/validation' },
          { text: 'Relationships', link: '/entity/relationships' },
          { text: 'Authorization', link: '/entity/authorization' }
        ]
      },
      {
        text: 'Database',
        items: [
          { text: 'Prisma', link: '/database/prisma' }
        ]
      },
      {
        text: 'Integration',
        items: [
          { text: 'Express', link: '/integration/express' },
          { text: 'Hono', link: '/integration/hono' }
        ]
      },
      {
        text: 'Plugin',
        items: [
          { text: 'Architecture', link: '/plugin/architecture' },
          { text: 'Creating Plugins', link: '/plugin/create' },
          { text: 'Auth', link: '/plugin/auth' },
          { text: 'Payments', link: '/plugin/payments' },
          { text: 'Storage', link: '/plugin/storage' },
          { text: 'Timestamps', link: '/plugin/timestamps' }
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'CRUD Operations', link: '/guides/crud' },
          { text: 'Filtering & Sorting', link: '/guides/filtering' },
          { text: 'Custom Endpoints', link: '/guides/custom-endpoints' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nevr-ts/nevr' }
    ],
    search: {
      provider: 'local'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Nevr Contributors'
    }
  }
})
