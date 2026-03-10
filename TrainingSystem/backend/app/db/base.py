from app.models.base import Base  # noqa: F401
from app.models.user import (  # noqa: F401
    User,
    Role,
    Permission,
    UserRole,
    RolePermission,
    Department,
    DepartmentMembership,
)
from app.models.document import (  # noqa: F401
    Document,
    DocumentVersion,
    DocumentParseTask,
    DocumentChunk,
)
from app.models.knowledge import (  # noqa: F401
    KnowledgePointCandidate,
    KnowledgePoint,
    KnowledgePointRelation,
)
from app.models.course import (  # noqa: F401
    Course,
    CourseVersion,
    CourseChapter,
    CourseGenerationTask,
)
from app.models.question import (  # noqa: F401
    Question,
    QuestionVersion,
    QuestionGenerationTask,
)
from app.models.review import (  # noqa: F401
    ReviewTask,
    ReviewComment,
)
from app.models.exam import (  # noqa: F401
    ExamPaper,
    ExamPaperItem,
    Exam,
    ExamAttempt,
    ExamAnswer,
)
from app.models.training import (  # noqa: F401
    TrainingTask,
    TrainingAssignment,
    StudyProgress,
)
from app.models.audit import (  # noqa: F401
    AuditLog,
    AsyncJob,
)
