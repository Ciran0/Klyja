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
uniform float u_line_thickness;

vec3 get_vertex_from_texture(int index) {
    float u = (mod(float(index), u_texture_size) + 0.5) / u_texture_size;
    float v = (floor(float(index) / u_texture_size) + 0.5) / u_texture_size;
    return texture2D(u_line_texture, vec2(u, v)).rgb;
}

// Final, correct, and simpler distance function
float dist_to_great_arc_segment(vec3 p, vec3 a, vec3 b) {
    // Handle the case where the segment is just a single point.
    if (dot(a, b) > 0.99999) {
        return acos(dot(p, a));
    }

    // Project pixel 'p' onto the great circle plane of the arc a-b to get point 'c'.
    vec3 n = normalize(cross(a, b));
    vec3 c = normalize(p - n * dot(p, n));

    // This is the correct check. A point 'c' is on the arc if its dot product
    // with BOTH endpoints is greater than the dot product of the endpoints themselves.
    // This is equivalent to saying angle(c,a) < angle(a,b) AND angle(c,b) < angle(a,b).
    // We add a tiny epsilon for floating point stability at the edges.
    float epsilon = 1e-5;
    if (dot(c, a) >= dot(a, b) - epsilon && dot(c, b) >= dot(a, b) - epsilon) {
        // Pixel is in the middle. Return distance to the infinite great circle.
        return abs(asin(dot(p, n)));
    }

    // Pixel is in an end-cap. Return distance to the closest endpoint.
    return min(acos(dot(p, a)), acos(dot(p, b)));
}


void main() {

    // --- DEBUG MODE ---
    // If debug mode is active, just show us the raw data from the texture.
    if (u_debug_mode) {
        // We are reading from the data texture using the sphere's own UV coordinates.
        // This will "unwrap" the data texture and paint it onto the sphere.
        // We only care about the .rgb channels, as that's where we stored our (x,y,z) data.
        gl_FragColor = vec4(texture2D(u_line_texture, v_uv).rgb, 1.0);
        return; // Stop here.
    }

    vec3 base_color = vec3(0.1, 0.3, 0.7);
    float min_dist = 1e6;

    for (int i = 0; i < MAX_LINE_SEGMENTS; i++) {
        if (i >= u_line_count) {
            break;
        }

        vec3 p1 = get_vertex_from_texture(i * 2);
        vec3 p2 = get_vertex_from_texture(i * 2 + 1);

        if (length(p1) < 0.1 || length(p2) < 0.1) {
            continue;
        }

        float dist = dist_to_great_arc_segment(normalize(v_world_pos), p1, p2);
        min_dist = min(min_dist, dist);
    }

    float feather = 0.0005;
    float line_alpha = 1.0 - smoothstep(u_line_thickness - feather, u_line_thickness + feather, min_dist);

    vec3 final_color = mix(base_color, u_line_color, line_alpha);

    gl_FragColor = vec4(final_color, 1.0);
}
