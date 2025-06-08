varying vec3 v_world_pos;
varying vec3 v_normal;

#define MAX_LINE_SEGMENTS 2048

uniform sampler2D u_line_texture;
uniform float u_texture_size;

uniform int u_line_count;
uniform float u_sphere_radius;
uniform vec3 u_line_color;
uniform float u_line_thickness;

vec3 get_vertex_from_texture(int index) {
    float u = (mod(float(index), u_texture_size) + 0.5) / u_texture_size;
    float v = (floor(float(index) / u_texture_size) + 0.5) / u_texture_size;
    return texture2D(u_line_texture, vec2(u, v)).rgb;
}

// Final robust distance function
float dist_to_great_arc_segment(vec3 p, vec3 a, vec3 b) {
    // Find the normal of the great circle plane defined by a and b.
    vec3 n = cross(a, b);

    // If a and b are the same point, length(n) will be 0.
    // This handles the "orange dot" case by just returning the distance to the point.
    if (length(n) < 0.00001) {
        return acos(dot(p, a));
    }
    n = normalize(n);

    // Project our pixel 'p' onto the great circle plane to find the closest point 'c'.
    vec3 c = normalize(p - n * dot(p, n));

    // This is the robust check to see if 'c' is between 'a' and 'b'.
    // It checks if the rotational order of (a,c) and (c,b) around the axis 'n' is positive.
    // This confirms 'c' is on the shorter arc.
    if (dot(cross(a, c), n) >= 0.0 && dot(cross(c, b), n) >= 0.0) {
        // The pixel is in the middle section. Return the distance to the great circle.
        return abs(asin(dot(p, n)));
    }

    // The pixel is in an "end-cap" region. Return distance to the closest endpoint.
    return min(acos(dot(p, a)), acos(dot(p, b)));
}

void main() {
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
