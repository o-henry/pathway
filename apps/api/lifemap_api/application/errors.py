class EntityNotFoundError(Exception):
    def __init__(self, entity_name: str, entity_id: str) -> None:
        super().__init__(f"{entity_name} '{entity_id}' was not found")
        self.entity_name = entity_name
        self.entity_id = entity_id
