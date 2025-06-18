varying vec2 v_uv;
varying vec3 v_world_pos;
varying vec3 v_normal;

#define MAX_LINE_SEGMENTS 2048

uniform sampler2D u_line_texture;
uniform float u_texture_size;

uniform bool u_debug_mode;

uniform int u_line_count;
uniform float u_sphere_radius;
uniform vec3 u_line_color;
uniform vec3 u_active_line_color; // <-- ADD THIS UNIFORM for the active color
uniform float u_line_thickness;

// MODIFICATION: This function now returns a vec4 to get all data (x, y, z, w)
vec4 get_vertex_data_from_texture(int index) {
    float u = (mod(float(index), u_texture_size) + 0.5) / u_texture_size;
    float v = (floor(float(index) / u_texture_size) + 0.5) / u_texture_size;
    // Return the full vec4 data from the texture
    return texture2D(u_line_texture, vec2(u, v));
}

// This function remains exactly the same.
float dist_to_great_arc_segment(vec3 p, vec3 a, vec3 b) {
    if (dot(a, b) > 0.99999) {
        return acos(dot(p, a));
    }
    vec3 n = normalize(cross(a, b));
    vec3 c = normalize(p - n * dot(p, n));
    float epsilon = 1e-5;
    if (dot(c, a) >= dot(a, b) - epsilon && dot(c, b) >= dot(a, b) - epsilon) {
        return abs(asin(dot(p, n)));
    }
    return min(acos(dot(p, a)), acos(dot(p, b)));
}

void main() {
    if (u_debug_mode) {
        gl_FragColor = vec4(texture2D(u_line_texture, v_uv).rgb, 1.0);
        return;
    }

    // This is our desired sphere color
    vec3 base_color = vec3(0.52, 0.65, 0.93);
    float min_dist = 1e6;
    float active_flag_of_closest_line = 1.0;

    for (int i = 0; i < MAX_LINE_SEGMENTS; i++) {
        if (i >= u_line_count) {
            break;
        }

        vec4 p1_data = get_vertex_data_from_texture(i * 2);
        vec4 p2_data = get_vertex_data_from_texture(i * 2 + 1);

        vec3 p1 = p1_data.xyz;
        vec3 p2 = p2_data.xyz;

        if (length(p1) < 0.1 || length(p2) < 0.1) {
            continue;
        }

        float dist = dist_to_great_arc_segment(normalize(v_world_pos), p1, p2);
        
        if (dist < min_dist) {
            min_dist = dist;
            active_flag_of_closest_line = p1_data.w;
        }
    }

    float feather = 0.0005;
    float line_alpha = 1.0 - smoothstep(u_line_thickness - feather, u_line_thickness + feather, min_dist);

    // Choose the correct color for the line
    vec3 chosen_line_color = u_line_color;
    if (active_flag_of_closest_line > 1.5) {
        chosen_line_color = u_active_line_color;
    }

    // This `mix` function now works correctly for the whole sphere.
    // - If line_alpha is 0, final_color will be base_color.
    // - If line_alpha is 1, final_color will be chosen_line_color.
    vec3 final_color = mix(base_color, chosen_line_color, line_alpha);

    // We set the final pixel color with full opacity.
    gl_FragColor = vec4(final_color, 1.0);
}
