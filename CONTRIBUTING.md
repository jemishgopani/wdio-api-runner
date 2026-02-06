# Contributing to wdio-api-runner

Thank you for your interest in contributing to wdio-api-runner! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on [GitHub Issues](https://github.com/jemishgopani/wdio-api-runner/issues) with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Your environment (Node.js version, OS, wdio-api-runner version)
- Relevant code snippets or error messages

### Suggesting Features

Feature requests are welcome! Please open an issue with:

- A clear description of the feature
- Use cases and benefits
- Any implementation ideas (optional)

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** with clear, descriptive commits
4. **Add tests** for any new functionality
5. **Ensure all tests pass**: `npm test`
6. **Ensure the build succeeds**: `npm run build`
7. **Submit a pull request** with a clear description of changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/wdio-api-runner.git
cd wdio-api-runner

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
wdio-api-runner/
├── src/
│   ├── api/           # HTTP API client
│   ├── assertions/    # Response assertions
│   ├── auth/          # Authentication helpers
│   ├── graphql/       # GraphQL client
│   ├── logging/       # HAR logging
│   ├── metrics/       # Performance metrics
│   └── subscriptions/ # GraphQL subscriptions
├── tests/             # Test files
├── docs/              # Documentation
└── build/             # Compiled output
```

## Coding Guidelines

### TypeScript

- Use TypeScript for all source files
- Provide complete type definitions for public APIs
- Avoid `any` types where possible
- Export types from module index files

### Code Style

- Use meaningful variable and function names
- Keep functions focused and small
- Add JSDoc comments for public APIs
- Follow existing code patterns

### Testing

- Write tests for all new functionality
- Maintain or improve code coverage
- Use descriptive test names
- Test edge cases and error conditions

### Commits

- Use clear, descriptive commit messages
- Keep commits focused on a single change
- Reference issue numbers when applicable

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/specific-test.test.ts
```

## Building

```bash
# Build the project
npm run build

# Clean build artifacts
npm run clean

# Rebuild from scratch
npm run clean && npm run build
```

## Documentation

When adding new features, please update:

- README.md if it affects main features
- Relevant docs in `/docs` directory
- API reference in `/docs/api-reference`
- CHANGELOG.md with your changes

## Questions?

If you have questions, feel free to:

- Open a [GitHub Issue](https://github.com/jemishgopani/wdio-api-runner/issues)
- Review existing documentation in `/docs`

Thank you for contributing!
