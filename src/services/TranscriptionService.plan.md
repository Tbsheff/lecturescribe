# Transcription Service Refactoring Plan

## Executive Summary
Refactor the transcription service from module-level initialization to a dependency injection pattern, enabling proper testing while maintaining backward compatibility and improving code quality.

## Problem Statement

### Current Issues
1. **Test Failures**: 9 tests failing due to Supabase client initialization at module level
2. **Timing Problem**: `createClient()` runs before test mocks are established
3. **Tight Coupling**: Service directly creates its dependencies
4. **Limited Flexibility**: Cannot easily swap providers or test with different configurations

### Root Cause
```typescript
// Current: Client created at module load time
const supabase = createClient(url, key); // Runs immediately, before mocks
```

## Solution Architecture

### Design Pattern: Dependency Injection with Factory

```typescript
// New: Dependencies injected via constructor
class TranscriptionService {
  constructor(
    private storage: StorageClient,
    private functions: FunctionsClient,
    private database: DatabaseClient
  ) {}
}

// Factory for convenience
export function createTranscriptionService(client?: SupabaseClient) {
  // Create with provided or default client
}

// Backward compatibility
export default createTranscriptionService();
```

## Implementation Details

### 1. Service Interface
```typescript
interface ITranscriptionService {
  transcribeAudio(file: File): Promise<string>;
  processAudioWithSummary(
    file: File,
    userId: string,
    metadata: any
  ): Promise<ProcessResult>;
  fetchNotes(): Promise<Note[]>;
  fetchNoteById(id: string): Promise<Note>;
}
```

### 2. Service Class Structure
```typescript
class TranscriptionService implements ITranscriptionService {
  constructor(/* dependencies */) {}

  // Public methods
  async transcribeAudio(file: File): Promise<string> {}
  async processAudioWithSummary(...) {}
  async fetchNotes() {}
  async fetchNoteById(id: string) {}

  // Private helpers
  private validateFile(file: File): ValidationResult {}
  private generateUploadPath(file: File): string {}
  private cleanup(path: string): Promise<void> {}
}
```

### 3. Error Handling
```typescript
// Typed errors for different failure modes
class ValidationError extends Error {}
class UploadError extends Error {}
class TranscriptionError extends Error {}
```

### 4. Testing Strategy
```typescript
// Tests inject mock dependencies
const mockStorage = { /* mock methods */ };
const mockFunctions = { /* mock methods */ };
const service = new TranscriptionService(mockStorage, mockFunctions, mockDb);

// Clean, simple test assertions
expect(await service.transcribeAudio(file)).toBe('transcript');
```

## Migration Path

### Phase 1: Create New Architecture (Non-Breaking)
1. Add new class-based implementation
2. Keep existing functions as wrappers
3. Ensure backward compatibility

### Phase 2: Update Tests
1. Refactor tests to use dependency injection
2. Remove complex mocking setup
3. Verify all tests pass

### Phase 3: Documentation
1. Document new architecture
2. Provide usage examples
3. Create testing guide

## Benefits Analysis

### Immediate Benefits
- ✅ All tests pass (fixes 9 failing tests)
- ✅ No breaking changes for existing code
- ✅ Cleaner, more maintainable code
- ✅ Better error handling

### Long-term Benefits
- ✅ Easy to add new features
- ✅ Can swap providers (Supabase → Firebase)
- ✅ Improved testability for future changes
- ✅ Clear separation of concerns
- ✅ Better TypeScript type safety

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing code | Low | High | Maintain backward compatibility layer |
| Test failures | Low | Medium | Comprehensive test suite |
| Performance impact | Very Low | Low | Minimal overhead from DI |

## Success Metrics

1. **Test Coverage**: All 70 tests passing (currently 61/70)
2. **Code Quality**: Improved separation of concerns
3. **Maintainability**: Easier to understand and modify
4. **Flexibility**: Can easily mock for testing

## Implementation Checklist

- [ ] Create service interface
- [ ] Implement service class
- [ ] Add error types
- [ ] Create factory function
- [ ] Maintain backward compatibility
- [ ] Update test file
- [ ] Verify all tests pass
- [ ] Document architecture
- [ ] Update CLAUDE.md if needed

## Code Examples

### Before (Current)
```typescript
// Tight coupling, hard to test
const supabase = createClient(url, key);

export const transcribeAudio = async (file: File) => {
  const { data } = await supabase.storage.from('audio').upload(...);
  // ...
};
```

### After (Proposed)
```typescript
// Loose coupling, easy to test
export class TranscriptionService {
  constructor(private deps: Dependencies) {}

  async transcribeAudio(file: File) {
    const { data } = await this.deps.storage.from('audio').upload(...);
    // ...
  }
}

// For production use
export default new TranscriptionService(createClient(url, key));

// For testing
const service = new TranscriptionService(mockDeps);
```

## Timeline

- **Step 1** (30 min): Refactor service to class-based architecture
- **Step 2** (20 min): Update tests to use dependency injection
- **Step 3** (10 min): Verify all tests pass
- **Step 4** (20 min): Document changes

**Total Estimated Time**: ~1.5 hours

## Decision Record

**Decision**: Use dependency injection pattern with factory function

**Rationale**:
1. Solves immediate testing problem
2. Improves code quality without over-engineering
3. Maintains backward compatibility
4. Follows established patterns in TypeScript/React ecosystem
5. Provides right level of abstraction for project size

**Alternatives Considered**:
- Module mocking with `vi.hoisted()` - Too fragile
- Lazy initialization - Doesn't improve structure
- Full repository pattern - Over-engineered for current needs

## Next Steps

1. Review this plan
2. Implement refactoring following the checklist
3. Run full test suite
4. Update documentation
5. Consider applying pattern to other services if successful