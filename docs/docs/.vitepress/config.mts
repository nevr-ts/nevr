import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/nevr/',
  title: "Nevr",
  description: "The Entity-First Backend Framework — Build industrial-grade APIs with workflows, services, and remote data stitching",
  head: [
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    ['meta', { property: 'og:title', content: 'Nevr — The Entity-First Backend Framework' }],
    ['meta', { property: 'og:description', content: 'Build industrial-grade APIs with workflows, services, and remote data stitching. All type-safe.' }],
  ],
  themeConfig: {
    logo: '/nevr_pp.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/get-started/introduction' },
      { text: 'API Reference', link: '/reference/overview' }
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/get-started/introduction' },
          { text: 'Installation', link: '/get-started/installation' },
          { text: 'Quick Start', link: '/get-started/quick-start' },
          { text: 'Basic Usage', link: '/get-started/basic-usage' },
          { text: 'Comparison', link: '/get-started/comparison' }
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'Philosophy', link: '/concepts/philosophy' },
          { text: 'Architecture', link: '/concepts/architecture' },
          { text: 'Entity-First Design', link: '/concepts/entity-first' },
          { text: 'Adapters', link: '/concepts/adapter' },
          { text: 'Plugins', link: '/concepts/plugin' },
          { text: 'Drivers', link: '/concepts/driver' },
          { text: 'Enhancements', link: '/concepts/enhancements' },
          { text: 'Type Safety', link: '/concepts/type-safety' }
        ]
      },
      {
        text: 'Fields',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/fields/overview' },
          { text: 'Field Types', link: '/fields/types' },
          { text: 'Modifiers', link: '/fields/modifiers' },
          { text: 'Validation', link: '/fields/validation' },
          { text: 'Transforms', link: '/fields/transforms' },
          { text: 'Security', link: '/fields/security' },
          { text: 'Access Policies', link: '/fields/access-policies' },
          { text: 'Relations', link: '/fields/relations' }
        ]
      },
      {
        text: 'Entities',
        collapsed: false,
        items: [
          { text: 'Defining Entities', link: '/entities/defining' },
          { text: 'Authorization Rules', link: '/entities/authorization' },
          { text: 'Cross-Field Validation', link: '/entities/cross-field-validation' },
          { text: 'Timestamps', link: '/entities/timestamps' },
          { text: 'Namespaces', link: '/entities/namespaces' }
        ]
      },
      {
        text: 'Actions & Workflows',
        collapsed: false,
        items: [
          { text: 'Actions Overview', link: '/actions/overview' },
          { text: 'Creating Actions', link: '/actions/creating' },
          { text: 'Pre-built Actions', link: '/actions/prebuilt' },
          { text: 'Workflows', link: '/actions/workflows' },
          { text: 'Saga Pattern', link: '/actions/saga-pattern' }
        ]
      },
      {
        text: 'Services & DI',
        collapsed: false,
        items: [
          { text: 'Service Container', link: '/services/container' },
          { text: 'Registering Services', link: '/services/registering' },
          { text: 'Resolving Services', link: '/services/resolving' },
          { text: 'Scoped Services', link: '/services/scoped' },
          { text: 'Service Lifecycle', link: '/services/lifecycle' }
        ]
      },
      {
        text: 'Remote Joiner',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/remote-joiner/overview' },
          { text: 'Remote Relations', link: '/remote-joiner/relations' },
          { text: 'External Services', link: '/remote-joiner/services' }
        ]
      },
      {
        text: 'Plugins',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/plugins/overview' },
          { text: 'Using Plugins', link: '/plugins/using' },
          { text: 'Creating Plugins', link: '/plugins/creating' },
          { text: 'Interceptors', link: '/plugins/interceptors' },
          {
            text: 'Auth Plugin',
            collapsed: false,
            items: [
              { text: 'Overview', link: '/plugins/auth' },
              { text: 'Magic Link', link: '/plugins/auth/magic-link' },
              { text: 'Two Factor', link: '/plugins/auth/two-factor' },
              { text: 'Phone Number', link: '/plugins/auth/phone-number' },
              { text: 'Anonymous', link: '/plugins/auth/anonymous' },
            ]
          },
          { text: 'Organization Plugin', link: '/plugins/organization' },
          { text: 'Payment Plugin', link: '/plugins/payment' },
          { text: 'Storage Plugin', link: '/plugins/storage' },
        ]
      },
      {
        text: 'Database',
        collapsed: true,
        items: [
          { text: 'Drivers Overview', link: '/database/drivers' },
          { text: 'Prisma', link: '/database/prisma' },
          { text: 'Enhanced Driver', link: '/database/enhanced-driver' },
          { text: 'Transactions', link: '/database/transactions' }
        ]
      },
      {
        text: 'HTTP Adapters',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/adapters/overview' },
          { text: 'Express', link: '/adapters/express' },
          { text: 'Hono', link: '/adapters/hono' },
          { text: 'Custom Adapters', link: '/adapters/custom' }
        ]
      },
      {
        text: 'CLI',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/cli/overview' },
          { text: 'Scaffolding', link: '/cli/scaffolding' },
          { text: 'Development', link: '/cli/development' },
          { text: 'Code Generation', link: '/cli/generate' },
          { text: 'Database Management', link: '/cli/database' }
        ]
      },
      {
        text: 'Client',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/client/overview' },
          { text: 'Entity Client', link: '/client/entity-client' },
          { text: 'Fetch Utilities', link: '/client/fetch' },
          { text: 'React Integration', link: '/client/react' },
          { text: 'Store & Atoms', link: '/client/store' },
          { text: 'Type Inference', link: '/reference/inference' }
        ]
      },
      {
        text: 'Guides',
        collapsed: true,
        items: [
          { text: 'AI-First Development', link: '/guide/ai-first' },
          { text: 'RAG & Vector Search', link: '/guide/rag' },
          { text: 'CRUD Operations', link: '/guides/crud' },
          { text: 'Filtering & Sorting', link: '/guides/filtering' },
          { text: 'Custom Endpoints', link: '/guides/custom-endpoints' },
          { text: 'Error Handling', link: '/guides/error-handling' },
          { text: 'Authentication', link: '/guides/authentication' },
          { text: 'Plugin Development', link: '/guide/plugin-development' },
          { text: 'OpenAPI Generation', link: '/guide/openapi' },
          // { text: 'Production Deployment', link: '/guides/production' }
          // { text: 'File Uploads', link: '/guides/file-uploads' }
        ]
      },
      {
        text: 'API Reference',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/reference/overview' },
          { text: 'nevr()', link: '/reference/nevr' },
          { text: 'entity()', link: '/reference/entity' },
          { text: 'Fields', link: '/reference/fields' },
          { text: 'Actions', link: '/reference/actions' },
          { text: 'Router', link: '/reference/router' },
          { text: 'Enhancements', link: '/reference/enhancements' },
          { text: 'Generator', link: '/reference/generator' },
          // { text: 'Type Inference', link: '/reference/inference' },
          { text: 'Errors', link: '/reference/errors' },
          { text: 'Types', link: '/reference/types' }
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
    },
    outline: {
      level: [2, 3]
    }
  }
})
