// frontend/tests/mocks/geco-mock.js
import { vi } from 'vitest';

export const Geco = vi.fn().mockImplementation(() => ({
  get_animation_name: vi.fn().mockReturnValue('Test Animation'),
  set_animation_name: vi.fn(),
  get_polygons_json: vi.fn().mockReturnValue('[]'),
  add_static_polygon: vi.fn(),
  add_point_to_active_polygon: vi.fn(),
  get_animation_protobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
  load_animation_protobuf: vi.fn()
}));

export default vi.fn().mockResolvedValue({});
