import os
import json
import re
import sys


def parse_issue_body(body):
    """
    Parses the markdown body of the issue to extract model_id and model_name.
    """
    model_id = None
    model_name = None

    # Regex patterns based on the issue template structure
    # We look for the header and then capture the text following it until the next header or end of string

    # Pattern for Model ID
    id_pattern = r"### 模型 ID \(Model ID\)\s*\n\s*(.+?)\s*(?=\n###|$)"
    id_match = re.search(id_pattern, body, re.DOTALL)
    if id_match:
        model_id = id_match.group(1).strip()

    # Pattern for Model Name
    name_pattern = (
        r"### 模型名稱與描述 \(Model Name & Description\)\s*\n\s*(.+?)\s*(?=\n###|$)"
    )
    name_match = re.search(name_pattern, body, re.DOTALL)
    if name_match:
        model_name = name_match.group(1).strip()

    return model_id, model_name


def update_models_json(model_id, model_name, file_paths):
    """
    Updates the models.json files with the new model.
    """
    new_entry = {"id": model_id, "name": model_name}

    updated = False

    for file_path in file_paths:
        if not os.path.exists(file_path):
            print(f"Warning: {file_path} not found.")
            continue

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Check if exists
            if any(m["id"] == model_id for m in data):
                print(f"Model {model_id} already exists in {file_path}.")
                continue

            data.append(new_entry)

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)

            print(f"Updated {file_path}")
            updated = True
        except Exception as e:
            print(f"Error updating {file_path}: {e}")
            sys.exit(1)

    return updated


def main():
    body = os.environ.get("ISSUE_BODY", "")
    if not body:
        print("No issue body found in environment variables.")
        sys.exit(1)

    print("Parsing issue body...")
    model_id, model_name = parse_issue_body(body)

    if not model_id or not model_name:
        print("Failed to extract Model ID or Model Name from issue body.")
        print(f"Extracted ID: {model_id}")
        print(f"Extracted Name: {model_name}")
        sys.exit(1)

    print(f"Found Model ID: {model_id}")
    print(f"Found Model Name: {model_name}")

    # Set output variables for GitHub Actions
    if "GITHUB_ENV" in os.environ:
        with open(os.environ["GITHUB_ENV"], "a") as f:
            f.write(f"MODEL_ID={model_id}\n")
            f.write(f"MODEL_NAME={model_name}\n")
    else:
        print("GITHUB_ENV not found, skipping env var output (Local testing mode).")

    # Update models.json in both locations
    # Note: dist/models.json is a build artifact, usually we only update source (public/models.json)
    # But checking list_dir, public/models.json seems to be the source.
    # We should update public/models.json.
    target_files = ["public/models.json"]

    update_success = update_models_json(model_id, model_name, target_files)

    if not update_success:
        print("No files were updated (maybe model already exists?).")
        # We exit with 0 to not fail the workflow, but we might want to skip PR creation.
        # But for now let's exit 0.


if __name__ == "__main__":
    main()
