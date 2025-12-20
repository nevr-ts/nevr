# Contributing to Nevr ⚡
---

First off, thank you for considering contributing to Nevr! By helping us, you are helping build a future where developers **never** have to write repetitive boilerplate again.



## 🌟 Our Philosophy
---

Nevr is designed to solve the **6 Backend Nightmares**. We believe:
1. **Best practices belong in the system**, not just in a Senior's head.
2. **Type-safety is non-negotiable.**
3. **The Plugin System is the heart.** If a feature is complex, it should be a plugin.



## 📜 Code of Conduct
---

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## 📂 Project Structure
---

Nevr is a monorepo. Here is where you can help:

- **`packages/nevr`**: The DSL engine and internal logic.
- **`packages/nevr/adapters`**: Connectors for HTTP frameworks (Express, Hono, Next.js).
- **`packages/nevr/drivers`**: Connectors for Database ORMs (Prisma, Drizzle, Kysely).
- **`packages/nevr/plugins`**: Modular logic (Auth, Payments, Realtime, Storage).
- **`packages/cli`**: The Command Line Interface for Nevr projects.
- **`packages/create-nevr`**: The project scaffolding tool.
- **`docs/`**: Documentation and guides for Nevr.
- **`examples/`**: Example projects demonstrating Nevr features.
- **`demo/`**:  demo application built with Nevr.

##  🌈 Contribution Guidelines
---

When contributing to Nevr, please keep the following guidelines in mind:

- Keep changes focused. Large PRs are harder to review and unlikely to be accepted. We recommend opening an issue and discussing it with us first.
- Ensure all code is type-safe and takes full advantage of TypeScript features.
- Write clear, self-explanatory code. Use comments only when truly necessary.
- Maintain a consistent and predictable API across all supported frameworks.
- Follow the existing code style and conventions.
- We aim for stability, so avoid changes that would require users to run a migration or update their config...




## 🛠️ Setting Up Your Development Environment
---
To set up your development environment for contributing to Nevr, follow these steps:
1. **Fork the Repository**: Start by forking the Nevr repository to your GitHub account.

2. **Clone Your Fork**: Clone your forked repository to your local machine.
   ```bash
   git clone https://github.com/your-username/nevr.git
    cd nevr
    ```
3. **install Node.js**: Ensure you have Node.js installed (version 18 or higher is recommended). You can download it from [nodejs.org](https://nodejs.org/).

4. **Install pnpm**: Nevr uses `pnpm` as its package manager. If you don't have it installed, you can do so by running:
   ```bash
    npm install -g pnpm
    ```
5. **Install Dependencies**: Use `pnpm` to install all necessary dependencies.
   ```bash
    pnpm install
    ```
6. **Run Tests**: Ensure everything is set up correctly by running the test suite.
   ```bash
    pnpm test
    ```
7. **Build the Project**: To build the project, run:
   ```bash
    pnpm build
    ```
8. **Run Type Checks**: Verify that your code is type-safe.
   ```bash
    pnpm type-check
    ```
9. **Run the documentation locally**: To view and edit the documentation, you can run:
   ```bash
    pnpm -F docs docs:dev
    ```
## 🚀 Contributing Workflow
---
We use GitHub Flow for our development process. Here’s a brief overview of how to contribute:
1. **Create a Branch**: Create a new branch for your feature or bug fix.
   ```bash
    git checkout -b type/description-of-feature
    # Example: git checkout -b feat/add-auth-plugin
    ```
    **Branch types prefix**:
    - `feat/` - New features
    - `fix/` - Bug fixes
    - `docs/` - Documentation updates
    - `chore/` - Maintenance tasks
    - `refactor/` - Code restructuring without changing functionality
    - `test/` - Adding or updating tests

2. **Make Changes**: Implement your changes in the appropriate files.

3. **Run Tests**: Before committing, ensure all tests pass.
   ```bash
    # Run all tests
        pnpm test

    # Run tests for a specific package
        pnpm -F "{package_name}" test
    ```
4. **Commit Changes**: Commit your changes with a descriptive message.
   ```bash
    git add .
    git commit -m "type: brief description of changes"
    # Example: git commit -m "feat: add new auth plugin"
    ```
5. **Push to Your Fork**: Push your changes to your forked repository.
   ```bash
    git push origin type/description-of-feature
    ```
6. **Open a Pull Request**: Go to the original Nevr repository and open a pull request from your forked branch.

## 📝 Pull Request Guidelines
---
When submitting a pull request, please ensure the following:
- Clearly describe what changes you made and why
- Include any relevant context or background
- List any breaking changes or deprecations
- Add screenshots for UI changes
- Reference related issues or discussions

## 📝 Commit Message Guidelines
---
We use Conventional Commits for our commit messages. Here are some examples:
- `feat: add new plugin for payments`
- `fix: resolve issue with type-safety in adapters`
- `docs: update contributing guidelines`
- `chore: update dependencies`
- `refactor: improve code structure in nevr core`
- `test: add tests for new features`
Please ensure your commit messages are clear and descriptive.

## 🧪 Testing Guidelines
---
All contributions must include appropriate tests. Follow these guidelines:
- Write unit tests for new features or bug fixes.
- Ensure existing tests pass before submitting a pull request.
- Update existing tests if necessary to reflect changes.
- Follow the existing test structure and conventions. 
- Test across different environments where applicable.

## 📚 Documentation Guidelines
---
Comprehensive documentation is crucial for Nevr. When contributing, please:
- Update or add documentation for new features or changes.
- Ensure documentation is clear, concise, and easy to understand.
- Follow the existing documentation style and format.

## 🛡️ Code Quality 
---
To maintain high code quality, please adhere to the following:
- Follow the established coding standards and conventions
- Use TypeScript type and interfaces effectively.
- Use meaningful variable and function names.
- Keep functions and methods focused and concise.
- Ensure proper error handling and edge cases are covered.
- Write clean, readable, and maintainable code.
- Add comments only when necessary to explain complex logic.
- Update related documentation when making changes.

## 🎉 Thank You!