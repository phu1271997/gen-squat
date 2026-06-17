import pytest
import sys

@pytest.fixture(autouse=True)
def patch_vm_context(direct_vm):
    vm_class = type(direct_vm)
    original_refresh = vm_class._refresh_gl_message

    def patched_refresh(self):
        original_refresh(self)
        if 'genlayer.gl' in sys.modules:
            gl = sys.modules['genlayer.gl']
            if hasattr(gl, 'message_raw') and gl.message_raw is not None:
                # Update datetime if set in direct_vm
                if hasattr(self, '_datetime') and self._datetime is not None:
                    gl.message_raw['datetime'] = self._datetime
                # Update value if set in direct_vm
                if hasattr(self, '_value') and self._value is not None:
                    gl.message_raw['value'] = self._value

    vm_class._refresh_gl_message = patched_refresh
    yield
    vm_class._refresh_gl_message = original_refresh
