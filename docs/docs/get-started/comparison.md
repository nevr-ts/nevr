# Comparison

Choosing the right tool depends on what you are building. Nevr fits into a specific niche: **Developer-First, Type-Safe, Standard REST APIs.**

## 1. Nevr vs. Frameworks (NestJS, Adonis)

This is the most direct comparison. Both are used to build scalable backends.

| Feature | NestJS / Adonis | Nevr |
| :--- | :--- | :--- |
| **Philosophy** | **"Everything Included"**. They provide modules for everything (Config, DI, ORM wrappers). | **"Data First"**. Nevr focuses 100% on your data entities and automates the rest. |
| **Boilerplate** | **High**. You write Controllers, Services, Modules, DTOs, and Interfaces manually. | **Zero**. You write the Entity. Nevr generates the Controller, Service, and Types. |
| **Flexibility** | **High**. You can build anything, but you have to wire it yourself. | **High**. You can drop down to raw Express/Hono anytime for custom logic. |
| **Verdict** | Use NestJS for massive enterprise monoliths with 100+ devs. | Use Nevr for startups, SaaS, and teams who want to ship fast. |

## 2. Nevr vs. Full-Stack RPC (tRPC)

tRPC is amazing for Next.js apps, but it has limits.

| Feature | tRPC | Nevr |
| :--- | :--- | :--- |
| **Architecture** | **Tightly Coupled**. The backend and frontend must be in the same repo (Monorepo). | **Decoupled**. Nevr generates a standard REST API. Your frontend can be anywhere. |
| **Consumers** | **TypeScript Only**. You cannot easily call a tRPC endpoint from a Mobile App or Python script. | **Universal**. Any HTTP client (Swift, Kotlin, Python, cURL) can call Nevr. |
| **Verdict** | Use tRPC if you *only* have a Next.js web app. | Use Nevr if you need a Mobile App, Public API, or multiple frontends. |

## 3. Nevr vs. Headless CMS (Strapi)

This is often a confusion point.

| Feature | Strapi | Nevr |
| :--- | :--- | :--- |
| **Target Audience** | **Content Editors**. People who need a UI to write blog posts. | **Developers**. People who write code to build applications. |
| **Source of Truth** | **Database/JSON**. Schemas are stored in complex JSON files. | **Code**. Schemas are TypeScript files in your repo. |
| **Verdict** | Use Strapi for a Blog or Marketing site. | Use Nevr for a SaaS, Social Network, or Tool. |
