varying vec3 v_world_pos; // The world position of this pixel, from the vertex shader
varying vec3 v_normal;    // The normal of this pixel, from the vertex shader

// --- Uniforms: Data passed in from JavaScript ---
#define MAX_LINE_SEGMENTS 2048 // MUST match the size of the JS array

uniform vec3 u_lines[MAX_LINE_SEGMENTS * 2]; // Our flattened line data [A1, B1, A2, B2, ...]
uniform int u_line_count;                    // How many segments are we actually using
uniform float u_sphere_radius;               // Radius of the sphere
uniform vec3 u_line_color;                   // The color for the lines
uniform float u_line_thickness;              // The thickness of the lines in radians

const float PI = 3.14159265359;

// --- Helper Function: Distance from a point `p` to a great-arc segment `a-b` ---
// All vectors (p, a, b) are assumed to be normalized (on the surface of the unit sphere).
float dist_to_great_arc_segment(vec3 p, vec3 a, vec3 b) {
    // 1. Create a "plane" for the great circle arc using the cross product.
    // The resulting vector is normal (perpendicular) to the surface of that plane.
    vec3 arc_plane_normal = normalize(cross(a, b));

    // 2. Project our point `p` onto this plane. The distance from `p` to its projection
    // is the shortest distance to the *infinite* great circle line.
    float dist_to_infinite_line = abs(dot(p, arc_plane_normal));

    // 3. Check if the closest point on the infinite line is actually *within* the arc segment a-b.
    // We do this by checking the angles.
    float angle_ap = acos(dot(a, p)); // Angle between start of arc and our point
    float angle_bp = acos(dot(b, p)); // Angle between end of arc and our point
    float angle_ab = acos(dot(a, b)); // Angle of the arc segment itself

    // If the sum of the sub-angles is very close to the total angle, p is on the segment.
    if (angle_ap + angle_bp > angle_ab - 0.0001) {
        // The point is outside the arc segment. The closest point is either a or b.
        return min(angle_ap, angle_bp);
    }

    // The point is inside the arc segment. The distance is the angle to the infinite line.
    // We convert the dot-product distance to an angular (radian) distance.
    return asin(dist_to_infinite_line);
}

void main() {
    // --- Base Color (can be replaced with a texture later) ---
    vec3 base_color = vec3(0.1, 0.3, 0.7); // A nice blue

    // --- Line Drawing Logic ---
    float min_dist = 1e6; // Initialize with a huge distance

    for (int i = 0; i < MAX_LINE_SEGMENTS; i++) {
        if (i >= u_line_count) {
            break; // Don't process empty parts of the array
        }
        
        vec3 p1 = u_lines[i * 2];
        vec3 p2 = u_lines[i * 2 + 1];

        // Calculate distance from the current pixel to this line segment
        float dist = dist_to_great_arc_segment(normalize(v_world_pos), p1, p2);
        
        // Keep the smallest distance found so far
        min_dist = min(min_dist, dist);
    }
    
    // --- Final Coloring ---
    // Use smoothstep to create a crisp, anti-aliased line.
    // It will return 1.0 if we are inside the line, 0.0 if outside, and a smooth
    // value in between for a "feather" effect at the edge.
    float line_alpha = 1.0 - smoothstep(u_line_thickness - 0.001, u_line_thickness + 0.001, min_dist);
    
    // Mix the base color and line color based on the alpha
    vec3 final_color = mix(base_color, u_line_color, line_alpha);
    
    gl_FragColor = vec4(final_color, 1.0);
}
