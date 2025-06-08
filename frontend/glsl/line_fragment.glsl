varying vec3 v_world_pos;
varying vec3 v_normal;

#define MAX_LINE_SEGMENTS 2048

// The big 'u_lines' array is GONE.
// We now have a 'sampler2D' to read from our data texture.
uniform sampler2D u_line_texture; 
uniform float u_texture_size; // The width/height of our square data texture

uniform int u_line_count;
uniform float u_sphere_radius;
uniform vec3 u_line_color;
uniform float u_line_thickness;

const float PI = 3.14159265359;

// Helper function to read a vertex's (x,y,z) coordinate from the texture
vec3 get_vertex_from_texture(int index) {
    // Convert the 1D index into a 2D texture coordinate (u,v)
    float u = mod(float(index), u_texture_size) / u_texture_size;
    float v = floor(float(index) / u_texture_size) / u_texture_size;
    
    // Read the pixel (texel) data at that coordinate.
    // We stored x,y,z in the r,g,b channels of the texture.
    return texture2D(u_line_texture, vec2(u, v)).rgb;
}

// The distance function itself doesn't need to change.
float dist_to_great_arc_segment(vec3 p, vec3 a, vec3 b) {
    vec3 arc_plane_normal = normalize(cross(a, b));
    float dist_to_infinite_line = abs(dot(p, arc_plane_normal));
    float angle_ap = acos(dot(a, p));
    float angle_bp = acos(dot(b, p));
    float angle_ab = acos(dot(a, b));
    if (angle_ap + angle_bp > angle_ab - 0.0001) {
        return min(angle_ap, angle_bp);
    }
    return asin(dist_to_infinite_line);
}

void main() {
    vec3 base_color = vec3(0.1, 0.3, 0.7); // Base sphere color
    float min_dist = 1e6; // A very large number

    for (int i = 0; i < MAX_LINE_SEGMENTS; i++) {
        if (i >= u_line_count) {
            break; // Stop if we've processed all active segments
        }
        
        // Read the two endpoint vertices for the current segment FROM THE TEXTURE
        vec3 p1 = get_vertex_from_texture(i * 2);
        vec3 p2 = get_vertex_from_texture(i * 2 + 1);

        float dist = dist_to_great_arc_segment(normalize(v_world_pos), p1, p2);
        min_dist = min(min_dist, dist);
    }
    
    float line_alpha = 1.0 - smoothstep(u_line_thickness - 0.001, u_line_thickness + 0.001, min_dist);
    vec3 final_color = mix(base_color, u_line_color, line_alpha);
    
    gl_FragColor = vec4(final_color, 1.0);
}
