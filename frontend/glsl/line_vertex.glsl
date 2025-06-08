// This is a "varying" variable. It lets us pass data from the vertex shader
// to the fragment shader. The GPU automatically interpolates its value
// for each pixel between the vertices.
varying vec3 v_world_pos;
varying vec3 v_normal;

void main() {
  // Pass the vertex's normal to the fragment shader
  v_normal = normal;
  
  // `modelMatrix` converts the local vertex position to its position in the 3D world.
  // We store this in a 4D vector (vec4) with 1.0 as the last component.
  vec4 world_pos_4d = modelMatrix * vec4(position, 1.0);
  
  // We only need the x,y,z part for our calculations.
  v_world_pos = world_pos_4d.xyz;
  
  // `gl_Position` is a special, required output variable. It tells the GPU
  // the final, on-screen position of the vertex.
  gl_Position = projectionMatrix * viewMatrix * world_pos_4d;
}
