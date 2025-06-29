import { cleanRedirect } from './cleanRedirect';
import { assertEquals } from '@test/assert';

function runTests() {
    console.log('Running cleanRedirect tests...');

    // Valid redirects
    assertEquals(cleanRedirect('/invite?token=abc-123'), '/invite?token=abc-123', 'Invite redirect should be allowed');
    assertEquals(cleanRedirect('/setup'), '/setup', 'Setup redirect should be allowed');
    assertEquals(cleanRedirect('/auth/resource/42'), '/auth/resource/42', 'Resource auth redirect should be allowed');

    // Invalid redirect defaults to '/'
    assertEquals(cleanRedirect('/not/allowed'), '/', 'Unknown redirect should fall back to root');
    assertEquals(cleanRedirect(''), '/', 'Empty redirect should fall back to root');
    assertEquals(cleanRedirect('/invite?token='), '/', 'Malformed invite token should fall back to root');

    console.log('All cleanRedirect tests passed!');
}

try {
    runTests();
} catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
}
