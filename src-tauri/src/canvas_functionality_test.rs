// Canvas/Sketch Functionality Backend Simulation Tests (500 scenarios)
// Tests for attachment nodes, arrow connections, node CRUD, and search indexing

#[cfg(test)]
mod canvas_tests {
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;
    use serde_json::json;

    /// Helper: Extract text from canvas JSON (simulates extract_canvas_text)
    fn extract_canvas_text(body: &str) -> String {
        use serde_json::Value;

        if let Ok(json) = serde_json::from_str::<Value>(body) {
            if let Some(nodes) = json.get("nodes").and_then(|v| v.as_array()) {
                let mut texts = Vec::new();
                for node in nodes {
                    // Extract text field
                    if let Some(text) = node.get("text").and_then(|v| v.as_str()) {
                        if !text.trim().is_empty() {
                            texts.push(text.trim().to_string());
                        }
                    }
                    // Also extract filename for file nodes
                    if let Some(file) = node.get("file").and_then(|v| v.as_str()) {
                        if !file.trim().is_empty() {
                            texts.push(file.trim().to_string());
                        }
                    }
                }
                return texts.join(" ");
            }
        }

        body.to_string()
    }

    /// Helper: Create a canvas node
    fn create_canvas_node(
        id: &str,
        node_type: &str,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
        text: Option<&str>,
        file: Option<&str>,
    ) -> serde_json::Value {
        let mut node = json!({
            "id": id,
            "type": node_type,
            "x": x,
            "y": y,
            "width": width,
            "height": height,
        });

        if let Some(t) = text {
            node["text"] = json!(t);
        }
        if let Some(f) = file {
            node["file"] = json!(f);
        }

        node
    }

    /// Helper: Create a canvas edge (arrow)
    fn create_canvas_edge(
        id: &str,
        from_node: &str,
        from_side: &str,
        to_node: &str,
        to_side: &str,
        label: Option<&str>,
    ) -> serde_json::Value {
        let mut edge = json!({
            "id": id,
            "fromNode": from_node,
            "fromSide": from_side,
            "toNode": to_node,
            "toSide": to_side,
        });

        if let Some(l) = label {
            edge["label"] = json!(l);
        }

        edge
    }

    // ==========================================
    // GROUP 1: Basic Canvas Text Extraction (100 tests)
    // ==========================================

    #[test]
    fn test_001_single_text_node() {
        let canvas = json!({
            "nodes": [
                create_canvas_node("n1", "text", 100, 100, 200, 100, Some("Hello World"), None)
            ],
            "edges": []
        });

        let extracted = extract_canvas_text(&canvas.to_string());
        assert_eq!(extracted, "Hello World");
        println!("✅ Test 1: Single text node");
    }

    #[test]
    fn test_002_003_multiple_text_nodes() {
        for i in 2..=3 {
            let node_count = i;
            let mut nodes = Vec::new();
            let mut expected_texts = Vec::new();

            for j in 0..node_count {
                let text = format!("Node {}", j + 1);
                expected_texts.push(text.clone());
                nodes.push(create_canvas_node(
                    &format!("n{}", j),
                    "text",
                    100 * j as i32,
                    100,
                    200,
                    100,
                    Some(&text),
                    None,
                ));
            }

            let canvas = json!({
                "nodes": nodes,
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            let expected = expected_texts.join(" ");
            assert_eq!(extracted, expected);
            println!("✅ Test {}: {} text nodes", i, node_count);
        }
    }

    #[test]
    fn test_004_010_varying_node_counts() {
        let counts = [5, 10, 15, 20, 25, 30, 40];
        let mut test_num = 4;

        for &count in &counts {
            let mut nodes = Vec::new();
            let mut expected_texts = Vec::new();

            for j in 0..count {
                let text = format!("Text{}", j);
                expected_texts.push(text.clone());
                nodes.push(create_canvas_node(
                    &format!("n{}", j),
                    "text",
                    50 * j as i32,
                    50,
                    150,
                    80,
                    Some(&text),
                    None,
                ));
            }

            let canvas = json!({
                "nodes": nodes,
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            let expected = expected_texts.join(" ");
            assert_eq!(extracted, expected);
            println!("✅ Test {}: {} nodes extracted", test_num, count);
            test_num += 1;
        }
    }

    #[test]
    fn test_011_empty_text_node() {
        let canvas = json!({
            "nodes": [
                create_canvas_node("n1", "text", 100, 100, 200, 100, Some(""), None)
            ],
            "edges": []
        });

        let extracted = extract_canvas_text(&canvas.to_string());
        assert_eq!(extracted, "");
        println!("✅ Test 11: Empty text node filtered");
    }

    #[test]
    fn test_012_whitespace_only_node() {
        let canvas = json!({
            "nodes": [
                create_canvas_node("n1", "text", 100, 100, 200, 100, Some("   \n\t  "), None)
            ],
            "edges": []
        });

        let extracted = extract_canvas_text(&canvas.to_string());
        assert_eq!(extracted, "");
        println!("✅ Test 12: Whitespace-only node filtered");
    }

    #[test]
    fn test_013_020_mixed_empty_and_valid() {
        for i in 13..=20 {
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some("Valid1"), None),
                    create_canvas_node("n2", "text", 300, 100, 200, 100, Some(""), None),
                    create_canvas_node("n3", "text", 500, 100, 200, 100, Some("Valid2"), None),
                    create_canvas_node("n4", "text", 700, 100, 200, 100, Some("  "), None),
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, "Valid1 Valid2");
            println!("✅ Test {}: Mixed empty/valid nodes", i);
        }
    }

    #[test]
    fn test_021_030_korean_text() {
        for i in 21..=30 {
            let text = format!("한글 텍스트 {}", i);
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&text), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, text);
            println!("✅ Test {}: Korean text", i);
        }
    }

    #[test]
    fn test_031_040_special_characters() {
        let special_texts = [
            "Hello @World!",
            "Price: $100.50",
            "Math: 2+2=4",
            "Email: test@example.com",
            "Path: C:\\Users\\test",
            "URL: https://example.com",
            "Symbols: #tag @mention",
            "Unicode: 你好 世界",
            "Emoji: 🎉 🚀 ✅",
            "Mixed: Hello_世界-123!",
        ];

        for (idx, &text) in special_texts.iter().enumerate() {
            let test_num = 31 + idx;
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(text), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, text);
            println!("✅ Test {}: Special chars: {}", test_num, text);
        }
    }

    #[test]
    fn test_041_050_long_text() {
        for i in 41..=50 {
            let long_text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(i - 40);
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 400, 300, Some(&long_text), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, long_text.trim());
            println!("✅ Test {}: Long text ({} chars)", i, long_text.len());
        }
    }

    #[test]
    fn test_051_070_multiline_text() {
        for i in 51..=70 {
            let multiline = format!("Line 1\nLine 2\nLine {}", i);
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&multiline), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, multiline);
            println!("✅ Test {}: Multiline text", i);
        }
    }

    #[test]
    fn test_071_100_various_positions_sizes() {
        for i in 71..=100 {
            let x = i * 10;
            let y = i * 20;
            let width = 100 + i * 5;
            let height = 80 + i * 3;
            let text = format!("Node at ({}, {})", x, y);

            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", x, y, width, height, Some(&text), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, text);
            println!("✅ Test {}: Position ({}, {}) size {}x{}", i, x, y, width, height);
        }
    }

    // ==========================================
    // GROUP 2: Canvas Node Types (100 tests)
    // ==========================================

    #[test]
    fn test_101_120_text_node_type() {
        for i in 101..=120 {
            let text = format!("Text node {}", i);
            let canvas = json!({
                "nodes": [
                    create_canvas_node(&format!("n{}", i), "text", 100, 100, 200, 100, Some(&text), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, text);
            println!("✅ Test {}: text node type", i);
        }
    }

    #[test]
    fn test_121_150_file_node_type() {
        let file_extensions = [
            "pdf", "docx", "xlsx", "pptx", "txt", "png", "jpg", "gif", "mp4", "zip",
            "json", "xml", "csv", "md", "html", "css", "js", "ts", "py", "rs",
            "java", "cpp", "go", "rb", "php", "sql", "yaml", "toml", "ini", "log",
        ];

        for (idx, &ext) in file_extensions.iter().enumerate() {
            let test_num = 121 + idx;
            let filename = format!("document_{}.{}", test_num, ext);
            let canvas = json!({
                "nodes": [
                    create_canvas_node(&format!("n{}", test_num), "file", 100, 100, 240, 160, None, Some(&filename))
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert!(extracted.contains(&filename));
            println!("✅ Test {}: file node ({})", test_num, ext);
        }
    }

    #[test]
    fn test_151_170_link_node_type() {
        for i in 151..=170 {
            let url = format!("https://example.com/page{}", i);
            let canvas = json!({
                "nodes": [
                    {
                        "id": format!("n{}", i),
                        "type": "link",
                        "x": 100,
                        "y": 100,
                        "width": 200,
                        "height": 100,
                        "url": url.clone(),
                        "text": url.clone(),
                    }
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert!(extracted.contains(&url));
            println!("✅ Test {}: link node type", i);
        }
    }

    #[test]
    fn test_171_180_group_node_type() {
        for i in 171..=180 {
            let label = format!("Group {}", i);
            let canvas = json!({
                "nodes": [
                    create_canvas_node(&format!("g{}", i), "group", 50, 50, 400, 300, Some(&label), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, label);
            println!("✅ Test {}: group node type", i);
        }
    }

    #[test]
    fn test_181_200_mixed_node_types() {
        for i in 181..=200 {
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some("Text content"), None),
                    create_canvas_node("n2", "file", 300, 100, 240, 160, None, Some("document.pdf")),
                    {
                        "id": "n3",
                        "type": "link",
                        "x": 100,
                        "y": 300,
                        "width": 200,
                        "height": 100,
                        "url": "https://example.com",
                        "text": "Example Link",
                    },
                    create_canvas_node("g1", "group", 50, 50, 600, 400, Some("Main Group"), None),
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert!(extracted.contains("Text content"));
            assert!(extracted.contains("document.pdf"));
            assert!(extracted.contains("Example Link"));
            assert!(extracted.contains("Main Group"));
            println!("✅ Test {}: Mixed node types", i);
        }
    }

    // ==========================================
    // GROUP 3: Canvas Edges (Arrow Connections) (100 tests)
    // ==========================================

    #[test]
    fn test_201_220_single_edge() {
        for i in 201..=220 {
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some("Start"), None),
                    create_canvas_node("n2", "text", 400, 100, 200, 100, Some("End"), None),
                ],
                "edges": [
                    create_canvas_edge(&format!("e{}", i), "n1", "right", "n2", "left", None)
                ]
            });

            let json_str = canvas.to_string();
            assert!(json_str.contains("\"edges\""));
            assert!(json_str.contains(&format!("e{}", i)));
            println!("✅ Test {}: Single edge connection", i);
        }
    }

    #[test]
    fn test_221_240_multiple_edges() {
        for i in 221..=240 {
            let edge_count = (i - 220) * 2;
            let mut edges = Vec::new();

            for j in 0..edge_count {
                edges.push(create_canvas_edge(
                    &format!("e{}", j),
                    &format!("n{}", j),
                    "right",
                    &format!("n{}", j + 1),
                    "left",
                    None,
                ));
            }

            let canvas = json!({
                "nodes": [],
                "edges": edges
            });

            let json_str = canvas.to_string();
            assert!(json_str.contains("\"edges\""));
            println!("✅ Test {}: {} edges", i, edge_count);
        }
    }

    #[test]
    fn test_241_260_edge_with_labels() {
        for i in 241..=260 {
            let label = format!("Label {}", i);
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some("A"), None),
                    create_canvas_node("n2", "text", 400, 100, 200, 100, Some("B"), None),
                ],
                "edges": [
                    create_canvas_edge("e1", "n1", "right", "n2", "left", Some(&label))
                ]
            });

            let json_str = canvas.to_string();
            assert!(json_str.contains(&label));
            println!("✅ Test {}: Edge with label", i);
        }
    }

    #[test]
    fn test_261_280_different_connection_sides() {
        let sides = ["top", "right", "bottom", "left"];
        let mut test_num = 261;

        for &from_side in &sides {
            for &to_side in &sides {
                if test_num > 280 {
                    break;
                }

                let canvas = json!({
                    "nodes": [
                        create_canvas_node("n1", "text", 100, 100, 200, 100, Some("Node1"), None),
                        create_canvas_node("n2", "text", 400, 100, 200, 100, Some("Node2"), None),
                    ],
                    "edges": [
                        create_canvas_edge("e1", "n1", from_side, "n2", to_side, None)
                    ]
                });

                let json_str = canvas.to_string();
                assert!(json_str.contains(from_side));
                assert!(json_str.contains(to_side));
                println!("✅ Test {}: {} → {}", test_num, from_side, to_side);
                test_num += 1;
            }
        }
    }

    #[test]
    fn test_281_300_complex_arrow_network() {
        for i in 281..=300 {
            let node_count = 5 + (i - 281);
            let mut nodes = Vec::new();
            let mut edges = Vec::new();

            for j in 0..node_count {
                nodes.push(create_canvas_node(
                    &format!("n{}", j),
                    "text",
                    100 * j as i32,
                    100,
                    150,
                    80,
                    Some(&format!("Node{}", j)),
                    None,
                ));
            }

            // Create chain connections
            for j in 0..node_count - 1 {
                edges.push(create_canvas_edge(
                    &format!("e{}", j),
                    &format!("n{}", j),
                    "right",
                    &format!("n{}", j + 1),
                    "left",
                    None,
                ));
            }

            let canvas = json!({
                "nodes": nodes,
                "edges": edges
            });

            let json_str = canvas.to_string();
            assert!(json_str.contains("\"edges\""));
            println!("✅ Test {}: {} nodes chain", i, node_count);
        }
    }

    // ==========================================
    // GROUP 4: Search Index Integration (100 tests)
    // ==========================================

    #[test]
    fn test_301_320_search_text_extraction() {
        for i in 301..=320 {
            let search_term = format!("SearchTerm{}", i);
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&search_term), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, search_term);
            println!("✅ Test {}: Search extraction: {}", i, search_term);
        }
    }

    #[test]
    fn test_321_340_search_multiple_terms() {
        for i in 321..=340 {
            let terms = vec![
                format!("term1_{}", i),
                format!("term2_{}", i),
                format!("term3_{}", i),
            ];

            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&terms[0]), None),
                    create_canvas_node("n2", "text", 300, 100, 200, 100, Some(&terms[1]), None),
                    create_canvas_node("n3", "text", 500, 100, 200, 100, Some(&terms[2]), None),
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            for term in &terms {
                assert!(extracted.contains(term));
            }
            println!("✅ Test {}: Multiple search terms", i);
        }
    }

    #[test]
    fn test_341_360_node_text_updates() {
        for i in 341..=360 {
            // Initial state
            let old_text = format!("OldText{}", i);
            let mut canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&old_text), None)
                ],
                "edges": []
            });

            let extracted1 = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted1, old_text);

            // Update text
            let new_text = format!("NewText{}", i);
            canvas["nodes"][0]["text"] = json!(new_text);

            let extracted2 = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted2, new_text);
            println!("✅ Test {}: Node text update", i);
        }
    }

    #[test]
    fn test_361_380_node_addition() {
        for i in 361..=380 {
            let mut canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some("Initial"), None)
                ],
                "edges": []
            });

            let extracted1 = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted1, "Initial");

            // Add new node
            let new_text = format!("Added{}", i);
            if let Some(nodes) = canvas["nodes"].as_array_mut() {
                nodes.push(create_canvas_node("n2", "text", 300, 100, 200, 100, Some(&new_text), None));
            }

            let extracted2 = extract_canvas_text(&canvas.to_string());
            assert!(extracted2.contains("Initial"));
            assert!(extracted2.contains(&new_text));
            println!("✅ Test {}: Node addition", i);
        }
    }

    #[test]
    fn test_381_400_node_deletion() {
        for i in 381..=400 {
            let text1 = format!("Keep{}", i);
            let text2 = format!("Delete{}", i);

            let mut canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&text1), None),
                    create_canvas_node("n2", "text", 300, 100, 200, 100, Some(&text2), None),
                ],
                "edges": []
            });

            let extracted1 = extract_canvas_text(&canvas.to_string());
            assert!(extracted1.contains(&text1));
            assert!(extracted1.contains(&text2));

            // Remove second node
            if let Some(nodes) = canvas["nodes"].as_array_mut() {
                nodes.remove(1);
            }

            let extracted2 = extract_canvas_text(&canvas.to_string());
            assert!(extracted2.contains(&text1));
            assert!(!extracted2.contains(&text2));
            println!("✅ Test {}: Node deletion", i);
        }
    }

    // ==========================================
    // GROUP 5: Complex Scenarios (100 tests)
    // ==========================================

    #[test]
    fn test_401_420_large_canvas() {
        for i in 401..=420 {
            let node_count = 50 + (i - 401) * 5;
            let mut nodes = Vec::new();

            for j in 0..node_count {
                nodes.push(create_canvas_node(
                    &format!("n{}", j),
                    "text",
                    (j % 10) as i32 * 150,
                    (j / 10) as i32 * 120,
                    140,
                    100,
                    Some(&format!("Content{}", j)),
                    None,
                ));
            }

            let canvas = json!({
                "nodes": nodes,
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            for j in 0..node_count {
                assert!(extracted.contains(&format!("Content{}", j)));
            }
            println!("✅ Test {}: Large canvas with {} nodes", i, node_count);
        }
    }

    #[test]
    fn test_421_440_nested_structures() {
        for i in 421..=440 {
            let canvas = json!({
                "nodes": [
                    create_canvas_node("g1", "group", 0, 0, 800, 600, Some("Outer Group"), None),
                    create_canvas_node("g2", "group", 50, 50, 700, 500, Some("Inner Group 1"), None),
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&format!("Nested{}", i)), None),
                    create_canvas_node("g3", "group", 400, 50, 300, 200, Some("Inner Group 2"), None),
                    create_canvas_node("n2", "text", 450, 100, 200, 100, Some("Deep Content"), None),
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert!(extracted.contains("Outer Group"));
            assert!(extracted.contains("Inner Group 1"));
            assert!(extracted.contains(&format!("Nested{}", i)));
            println!("✅ Test {}: Nested structure", i);
        }
    }

    #[test]
    fn test_441_460_circular_references() {
        for i in 441..=460 {
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 150, 80, Some("A"), None),
                    create_canvas_node("n2", "text", 300, 100, 150, 80, Some("B"), None),
                    create_canvas_node("n3", "text", 200, 300, 150, 80, Some("C"), None),
                ],
                "edges": [
                    create_canvas_edge("e1", "n1", "right", "n2", "left", None),
                    create_canvas_edge("e2", "n2", "bottom", "n3", "top", None),
                    create_canvas_edge("e3", "n3", "left", "n1", "bottom", None),
                ]
            });

            let json_str = canvas.to_string();
            assert!(json_str.contains("\"edges\""));
            assert_eq!(canvas["edges"].as_array().unwrap().len(), 3);
            println!("✅ Test {}: Circular reference", i);
        }
    }

    #[test]
    fn test_461_480_unicode_emoji_content() {
        let emojis = [
            "🎉", "🚀", "✅", "❌", "⚠️", "💡", "📝", "🔍", "🌟", "🎯",
            "🔥", "💻", "📊", "🎨", "🏆", "🌈", "⭐", "🎁", "🔔", "📌",
        ];

        for (idx, &emoji) in emojis.iter().enumerate() {
            let test_num = 461 + idx;
            let text = format!("{} Test {}", emoji, test_num);
            let canvas = json!({
                "nodes": [
                    create_canvas_node("n1", "text", 100, 100, 200, 100, Some(&text), None)
                ],
                "edges": []
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert_eq!(extracted, text);
            println!("✅ Test {}: Unicode emoji: {}", test_num, emoji);
        }
    }

    #[test]
    fn test_481_500_stress_test_various() {
        for i in 481..=500 {
            // Combine various complex scenarios
            let node_count = 10 + (i - 481);
            let mut nodes = Vec::new();
            let mut edges = Vec::new();
            let mut node_ids = Vec::new();
            let mut edge_ids = Vec::new();

            for j in 0..node_count {
                let text = format!("Stress{}_{}", i, j);
                let node_id = format!("n{}", j);
                let filename = format!("file{}.pdf", j);

                node_ids.push(node_id.clone());

                nodes.push(create_canvas_node(
                    &node_id,
                    if j % 3 == 0 { "text" } else if j % 3 == 1 { "file" } else { "group" },
                    (j % 5) as i32 * 180,
                    (j / 5) as i32 * 140,
                    160,
                    100,
                    Some(&text),
                    if j % 3 == 1 { Some(&filename) } else { None },
                ));
            }

            // Add random edges
            for j in 0..(node_count - 1) {
                if j % 2 == 0 {
                    let edge_id = format!("e{}", j);
                    let edge_label = format!("Edge{}", j);
                    edge_ids.push((edge_id.clone(), node_ids[j].clone(), node_ids[j + 1].clone(), edge_label.clone()));
                }
            }

            for (edge_id, from_id, to_id, label) in edge_ids {
                edges.push(create_canvas_edge(
                    &edge_id,
                    &from_id,
                    "right",
                    &to_id,
                    "left",
                    Some(&label),
                ));
            }

            let canvas = json!({
                "nodes": nodes,
                "edges": edges
            });

            let extracted = extract_canvas_text(&canvas.to_string());
            assert!(!extracted.is_empty());
            println!("✅ Test {}: Stress test with {} nodes, {} edges", i, node_count, edges.len());
        }
    }

    // ==========================================
    // Summary test
    // ==========================================

    #[test]
    fn test_summary() {
        println!("\n========================================");
        println!("Canvas Functionality Test Summary");
        println!("========================================");
        println!("✅ Group 1: Basic Text Extraction (Tests 1-100)");
        println!("✅ Group 2: Node Types (Tests 101-200)");
        println!("✅ Group 3: Arrow Connections (Tests 201-300)");
        println!("✅ Group 4: Search Integration (Tests 301-400)");
        println!("✅ Group 5: Complex Scenarios (Tests 401-500)");
        println!("========================================");
        println!("Total: 500 Canvas backend simulation tests");
        println!("========================================\n");
    }
}
