import { describe, it, expect } from 'vitest';
import { render } from '@/test/test-utils';

describe('Test Setup', () => {
  it('should render a simple component', () => {
    const { getByText } = render(<div>Hello Test</div>);
    expect(getByText('Hello Test')).toBeInTheDocument();
  });

  it('should have access to custom matchers', () => {
    const { container } = render(<div className="test-class">Test</div>);
    const element = container.querySelector('.test-class');
    expect(element).toHaveClass('test-class');
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('resolved');
    await expect(promise).resolves.toBe('resolved');
  });
});